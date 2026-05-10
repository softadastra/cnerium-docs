# Releases

This section tracks Cnerium release notes.

Use it to understand what changed between versions, which modules were updated, and what to upgrade in your project.

## Current release

```txt
0.5.0
```

[Open Cnerium 0.5.0 release notes](/releases/0.5.0)

## Release format

Each release page follows a simple structure:

```txt
version
date
summary
modules updated
new features
improvements
breaking changes
upgrade steps
known notes
```

## Versioning

Cnerium modules use semantic versions.

```txt
MAJOR.MINOR.PATCH
```

Example:

```txt
0.5.0
```

Meaning:

| Part | Meaning |
|---|---|
| `MAJOR` | Breaking API changes |
| `MINOR` | New features or module improvements |
| `PATCH` | Fixes and small compatible changes |

Cnerium is currently in the `0.x` phase, so APIs can still evolve quickly.

## Main packages

The current Cnerium stack is composed of these packages:

```txt
cnerium/json
cnerium/http
cnerium/router
cnerium/middleware
cnerium/server
cnerium/runtime
cnerium/app
```

## Current package versions

```txt
cnerium/json        0.4.0
cnerium/http        0.7.0
cnerium/router      0.6.0
cnerium/middleware  0.3.0
cnerium/server      0.5.0
cnerium/runtime     0.4.0
cnerium/app         0.5.0
```

## Dependency chain

The high-level app package pulls the framework stack through dependencies.

```txt
cnerium/app
  -> cnerium/runtime
    -> cnerium/server
      -> cnerium/middleware
        -> cnerium/http
        -> cnerium/json
      -> cnerium/router
        -> cnerium/http
```

For most applications, install only:

```bash
vix add cnerium/app
```

## Upgrade a project

To upgrade Cnerium in an existing project:

```bash
vix registry sync
vix update cnerium/app --install
vix check --tests
```

If your project depends on lower-level modules directly, update those too:

```bash
vix update cnerium/json cnerium/http cnerium/router --install
vix update cnerium/middleware cnerium/server cnerium/runtime cnerium/app --install
```

## Check installed packages

```bash
vix list
```

## Check outdated packages

```bash
vix registry sync
vix outdated
```

## Install Cnerium for a new project

```bash
vix new api
cd api
vix add cnerium/app
vix dev
```

## Recommended upgrade flow

```bash
git status

vix registry sync
vix outdated

vix update cnerium/app --install

vix check --tests
vix build --preset release
```

Then commit the updated dependency files:

```bash
git add vix.json vix.lock
git commit -m "chore(deps): update cnerium"
```

## Release notes

| Version | Notes |
|---|---|
| `0.5.0` | [Open release notes](/releases/0.5.0) |

## What to read after releases

If you are upgrading an app, read:

```txt
/reference/app
/reference/app-context
/reference/app-config
```

If you are using lower-level modules, read:

```txt
/modules/server
/modules/runtime
/modules/middleware
/modules/router
```

## Summary

Cnerium releases are documented here.

Start with the current release:

[Open Cnerium 0.5.0 release notes](/releases/0.5.0)
