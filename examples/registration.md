# Registration

This example shows how to use a Cnerium durable route for a user registration flow.

Registration is a useful example because retry behavior can create confusing application state. A client may submit a signup form, the backend may create the account or pending registration, and the response may still be lost before the client receives it. If the client retries and the backend treats the retry as a new request, the system may create duplicate pending records, duplicate welcome emails, duplicate verification tokens, or inconsistent account state.

Cnerium does not replace the application’s user system, authentication model, database, password hashing, email verification, or security rules. This example focuses only on the durable route pattern: one logical registration attempt, one `Idempotency-Key`, one stored response.

The backend remains a Vix backend:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the application. Cnerium attaches to it and protects the registration route.

## Route structure

This example exposes two routes:

```txt
GET /health
POST /users/register
```

`GET /health` is a normal Vix route.

`POST /users/register` is a durable Cnerium route because it represents a write operation that should not be executed twice by accident.

The durable operation name is:

```txt
users.register
```

That name scopes the idempotency state for registration attempts. It should remain stable once the route is used by clients.

## Complete example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

struct Registration
{
  std::string id;
  std::string email;
  std::string username;
  std::string status;
};

Registration create_registration(
    const std::string &idempotency_key,
    const std::string &email,
    const std::string &username)
{
  return Registration{
      "reg_" + idempotency_key,
      email,
      username,
      "pending_verification"};
}

bool looks_like_email(const std::string &value)
{
  return value.find('@') != std::string::npos &&
         value.find('.') != std::string::npos;
}

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "registration"}
    });
  });

  cnerium.durable_post(
      "/users/register",
      "users.register",
      [](cnerium::DurableRequest &request)
      {
        const auto body = request.json();
        const std::string email = cnerium::support::string_or(body, "email", "");
        const std::string username = cnerium::support::string_or(body, "username", "");

        if (email.empty())
        {
          return cnerium::DurableResponse::bad_request(
              "Missing required field: email");
        }

        if (!looks_like_email(email))
        {
          return cnerium::DurableResponse::bad_request(
              "Field email must be a valid email address");
        }

        if (username.empty())
        {
          return cnerium::DurableResponse::bad_request(
              "Missing required field: username");
        }

        const Registration registration =
            create_registration(
                request.idempotency_key_value(),
                email,
                username);

        return cnerium::created({
            {"ok", true},
            {"registration_id", registration.id},
            {"email", registration.email},
            {"username", registration.username},
            {"status", registration.status}
        });
      });

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

This example uses a deterministic registration id derived from the idempotency key. That keeps the behavior easy to test. In a real backend, the registration id would usually come from the database.

The important point is not how the id is generated. The important point is that the handler runs only once for the same durable operation.

## Request body

The registration route expects JSON like this:

```json
{
  "email": "gaspard@example.com",
  "username": "gaspard"
}
```

The handler reads the body through `DurableRequest`:

```cpp
const auto body = request.json();

const std::string email =
    cnerium::support::string_or(body, "email", "");

const std::string username =
    cnerium::support::string_or(body, "username", "");
```

The example keeps validation simple. A real registration system should do more: normalize email addresses, validate username rules, check uniqueness, hash passwords when passwords are involved, create verification tokens, enforce rate limits, and protect against abuse.

Cnerium does not replace those requirements. It protects the retry behavior around the route.

## First request

Send a registration request with an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: registration-123" \
  -d '{"email":"gaspard@example.com","username":"gaspard"}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

Example body:

```json
{
  "ok": true,
  "registration_id": "reg_registration-123",
  "email": "gaspard@example.com",
  "username": "gaspard",
  "status": "pending_verification"
}
```

This is the first request for `users.register` with the key `registration-123`. Cnerium executes the handler, stores the request hash, stores the durable response, and returns the result.

## Safe retry

Send the same request again with the same key and the same body:

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: registration-123" \
  -d '{"email":"gaspard@example.com","username":"gaspard"}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

The response body should match the first response.

Cnerium should return the stored response instead of running the handler again. This avoids duplicate account creation work for the same registration attempt.

## Unsafe key reuse

Now reuse the same key with a different body:

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: registration-123" \
  -d '{"email":"other@example.com","username":"other"}'
```

Expected status:

```txt
HTTP/1.1 409 Conflict
```

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This request is not a retry of the original registration. It is a different payload using an already consumed key. Cnerium rejects it before the handler runs.

## Missing Idempotency-Key

A durable registration route requires an idempotency key:

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gaspard@example.com","username":"gaspard"}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

Without the key, Cnerium cannot know whether the request is new or a retry. For durable write operations, that is not enough information.

## Validation errors

Send an invalid email:

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: registration-invalid-1" \
  -d '{"email":"not-an-email","username":"gaspard"}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

If the user corrects the email address, the corrected request should use a new idempotency key because the body changed.

```bash
curl -i -X POST http://127.0.0.1:8080/users/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: registration-valid-1" \
  -d '{"email":"gaspard@example.com","username":"gaspard"}'
```

The rule is the same for every durable route:

```txt
same key + same body
  same operation attempt

new body
  new operation attempt
```

A corrected form submission is a new attempt and should use a new key.

## Why registration benefits from durability

Registration often triggers multiple side effects.

A real registration handler may:

```txt
create a user row
create a pending registration record
reserve a username
hash a password
create a verification token
send a verification email
write an audit event
emit a realtime admin notification
```

If a client retries after a lost response, those actions should not all happen again for the same registration attempt.

Cnerium protects the handler from running twice for the same key and body. A safe retry receives the stored response.

## Add a service boundary

A real backend should not keep all registration logic inside the route.

Move domain work into a service:

```cpp
class RegistrationService
{
public:
  Registration create(
      const std::string &idempotency_key,
      const std::string &email,
      const std::string &username)
  {
    return create_registration(
        idempotency_key,
        email,
        username);
  }
};
```

Then use it from the durable handler:

```cpp
RegistrationService registrations;

cnerium.durable_post(
    "/users/register",
    "users.register",
    [&registrations](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string email = cnerium::support::string_or(body, "email", "");
      const std::string username = cnerium::support::string_or(body, "username", "");

      if (email.empty())
      {
        return cnerium::DurableResponse::bad_request(
            "Missing required field: email");
      }

      if (username.empty())
      {
        return cnerium::DurableResponse::bad_request(
            "Missing required field: username");
      }

      const Registration registration =
          registrations.create(
              request.idempotency_key_value(),
              email,
              username);

      return cnerium::created({
          {"ok", true},
          {"registration_id", registration.id},
          {"email", registration.email},
          {"username", registration.username},
          {"status", registration.status}
      });
    });
```

The service only runs when Cnerium allows the handler to execute. Safe retries replay the stored response.

## Realtime registration event

A registration route can emit an event after successful creation:

```cpp
cnerium.emit(
    "user.registration.created",
    cnerium::support::object({
        {"registration_id", cnerium::Json(registration.id)},
        {"email", cnerium::Json(registration.email)},
        {"username", cnerium::Json(registration.username)},
        {"status", cnerium::Json(registration.status)}
    }));
```

If the same request is retried safely, the handler does not run again. That means this event is not emitted again by the handler.

This prevents duplicate realtime notifications for the same completed registration attempt.

## Real backend considerations

This example is intentionally small. A production registration system needs more than durable retry handling.

Consider adding:

```txt
password hashing
email normalization
unique constraints for email and username
verification tokens
email delivery with retry handling
rate limiting
abuse prevention
audit logs
authorization rules where needed
database transactions
clear account state transitions
```

Cnerium is not a security framework and it is not an authentication system. It provides durable route behavior for critical operations.

Use it with the rest of your backend correctness and security model.

## What to verify

When this example works correctly, these behaviors should hold:

```txt
POST /users/register with a new key and valid body
  returns 201 Created

POST /users/register with the same key and same body
  returns the same stored response

POST /users/register with the same key and different body
  returns 409 Conflict

POST /users/register without Idempotency-Key
  returns 400 Bad Request
```

If the safe retry executes the handler again, check that the key and body are exactly the same.

If the conflict test does not return `409`, make sure the route is registered with `cnerium.durable_post`, not `app.post`.

## Summary

The registration example shows how Cnerium protects a common account-creation flow.

The backend remains a Vix backend. Cnerium attaches to `vix::App` and protects `POST /users/register` with an idempotency key, request body hashing, stored response replay, and conflict detection.

A safe retry returns the stored response. A changed body with the same key returns `409 Conflict`. The durable handler is not executed twice for the same completed registration attempt.
