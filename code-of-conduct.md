# Code of Conduct

Cnerium is a technical project built around reliability, correctness, and clear engineering boundaries.

The community should reflect the same values. Discussions should be direct, respectful, useful, and focused on improving the project.

This code of conduct applies to project spaces such as issues, pull requests, discussions, documentation, examples, code review, community channels, and any other space officially connected to Cnerium.

## Our standard

Cnerium contributors and users are expected to communicate professionally.

Good participation means:

```txt
Be respectful.
Be precise.
Assume good intent when reasonable.
Explain technical disagreements clearly.
Focus criticism on ideas, code, design, and behavior.
Help keep the project direction understandable.
```

Cnerium is a reliability-first backend layer for Vix applications. It should remain clear, focused, and useful. Community discussion should help that goal, not distract from it.

## Expected behavior

Examples of expected behavior include:

```txt
using welcoming and respectful language
giving constructive technical feedback
explaining why a change helps or hurts the project
being patient with new contributors
asking for clarification when something is unclear
accepting corrections when evidence shows a mistake
keeping discussions focused on the issue or pull request
respecting the project’s design boundaries
```

A strong technical disagreement is allowed. It should still be expressed in a way that helps the project move forward.

For example, this is useful:

```txt
This change makes Cnerium look like a second HTTP framework.
I think it should stay in Vix because Vix owns routing and middleware.
Can we keep Cnerium focused on durable route behavior here?
```

This is not useful:

```txt
This is stupid.
You do not understand the project.
```

The first version explains the problem. The second only attacks the person.

## Unacceptable behavior

Unacceptable behavior includes:

```txt
harassment
insults or personal attacks
threats or intimidation
discriminatory language
sexualized language or imagery
deliberate disruption of discussions
trolling
repeated off-topic arguments
public sharing of private information
posting secrets, tokens, private keys, or credentials
encouraging unsafe or illegal behavior
```

Technical frustration is understandable. Personal attacks are not acceptable.

## Technical disagreements

Cnerium is a technical project, so disagreements will happen.

Disagreements should be handled through evidence, examples, tests, benchmarks, architecture reasoning, and clear explanations.

When discussing a design change, focus on questions such as:

```txt
Does this preserve the Vix ownership model?
Does this keep Cnerium focused on durable write operations?
Does this improve retry safety?
Does this preserve idempotency behavior?
Does this keep adapters thin?
Does this avoid exposing private Softadastra engine internals?
Does this make the public API easier to understand?
```

A design should be judged by whether it strengthens the project, not by who proposed it.

## Project direction

Contributors should respect Cnerium’s direction.

The project exists to add reliability behavior to selected Vix backend operations.

Cnerium should focus on:

```txt
durable routes
idempotency
request body hashing
replay protection
stored responses
retry-safe handler execution
realtime events tied to durable operations
Softadastra SDK-backed reliability storage
thin adapters for Vix and Softadastra SDK
```

Cnerium should not become:

```txt
a replacement for Vix
a second HTTP server
a second router
a full middleware framework
a full ORM
a frontend framework
a deployment platform
a general WebSocket framework
a general business application framework
```

It is acceptable to propose changes. It is also acceptable for maintainers to reject changes that do not fit the project direction.

## Code review expectations

Code review should be honest and constructive.

Good review comments explain the issue and, when useful, suggest a direction.

Good example:

```txt
This stores the response body before the request hash.
Could that create a replay inconsistency if the second write fails?
I think we should either commit both records atomically or store a combined record.
```

Poor example:

```txt
Bad implementation.
```

Reviewers should be direct without being hostile.

Authors should treat review as part of the work, not as a personal attack.

## Documentation discussions

Documentation should be professional, accurate, and grounded in the real architecture.

When reviewing docs, focus on whether the content:

```txt
explains the Cnerium and Vix boundary clearly
uses the current public API
avoids vague marketing language
avoids artificial repetition
helps developers understand durable route behavior
does not duplicate the full Vix documentation
does not expose internal Softadastra engine concepts unnecessarily
```

Documentation should help real developers understand the project.

## Security-sensitive behavior

Do not post secrets in public project spaces.

This includes:

```txt
access tokens
private keys
passwords
session cookies
payment data
customer data
production logs with sensitive information
private server addresses when not intended for disclosure
```

If a security issue is being reported, use sanitized examples.

When discussing idempotency keys, stored responses, logs, or storage paths, avoid sharing real private data.

## Maintainer responsibilities

Maintainers are responsible for keeping project spaces healthy and focused.

Maintainers may:

```txt
ask for clarification
edit or remove inappropriate content
close off-topic discussions
reject changes that do not fit the project direction
request changes in pull requests
temporarily or permanently restrict participation when necessary
```

Maintainers should apply this code of conduct fairly and consistently.

## Enforcement

If unacceptable behavior occurs, maintainers may take action depending on the situation.

Possible actions include:

```txt
a private or public warning
editing or deleting inappropriate content
locking a discussion
closing an issue or pull request
temporary restriction from project spaces
permanent restriction from project spaces
```

The goal is not punishment for its own sake. The goal is to protect the project and the people working on it.

## Reporting

If you see behavior that violates this code of conduct, report it to the project maintainers.

When reporting, include:

```txt
what happened
where it happened
who was involved
links or screenshots if available
why you believe it violates the code of conduct
```

Do not include private or sensitive information unless it is necessary for the report.

Reports should be handled with care.

## Scope

This code of conduct applies to official Cnerium spaces.

It may also apply when behavior outside official spaces directly affects the safety, trust, or participation of the Cnerium community.

## Summary

Cnerium is built around reliability and clarity. The community should work the same way.

Be respectful. Be precise. Keep discussions useful. Disagree with ideas, not people. Protect the project’s direction. Help make Cnerium a focused and trustworthy reliability layer for Vix applications.
