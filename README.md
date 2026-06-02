# Cnerium

**A reliability-first backend layer for Vix.**

Cnerium attaches to an existing Vix backend and adds durable route behavior for critical write operations.

It is designed for routes that must stay correct under retries, timeouts, lost responses, process restarts, and unstable networks

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [](cnerium::DurableRequest &request)
      {
        return cnerium::created({
            {"ok", true}
        });
      });

  cnerium.start();
  app.run();
}
```

## What Cnerium provides

- Durable routes for critical backend writes
- Idempotency with `Idempotency-Key`
- Request body hashing
- Replay protection
- Stored responses for safe retries
- `409 Conflict` for unsafe key reuse
- Realtime events tied to durable handler execution
- Softadastra SDK-backed reliability storage

## What Cnerium is not

Cnerium does not replace Vix.

Vix remains the backend runtime, HTTP server, router, WebSocket transport, build workflow, and application foundation.

Cnerium attaches to Vix and protects selected write operations.

## Links

- Website: [cnerium.dev](https://cnerium.dev)
- Documentation: [docs.cnerium.dev](https://docs.cnerium.dev)
- Registry: [registry.vixcpp.com/pkg/softadastra/cnerium](https://registry.vixcpp.com/pkg/softadastra/cnerium)
- Vix: [vixcpp.com](https://vixcpp.com)
- Softadastra: [softadastra.com](https://softadastra.com)

## License

MIT License.
