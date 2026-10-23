# End-to-end suites

These drive a **running** TalkZen over HTTP and WebSocket, the same way a browser or an
embedded widget would. Nothing here imports from `apps/api` or mocks anything, so a suite that
passes is telling you a real client would get that result.

They live in the repo on purpose: they used to sit in a scratch directory and kept disappearing,
which meant every session started by rewriting them.

## Running them

Start a database and an API first, then:

```sh
cd qa
npm install          # once
npm run test:api     # every suite except the browser ones
npm test             # everything, including browser suites
```

One suite, or a group:

```sh
sh run-all.sh visitor      # only suites whose filename contains "visitor"
node suites/client-ip.js   # one suite, with its full output
```

## Pointing them somewhere else

| Variable | Default | What it is |
| --- | --- | --- |
| `QA_API_URL` | `http://127.0.0.1:4100/api/v1` | The API, including its version prefix |
| `QA_WEB_URL` | `http://127.0.0.1:3000` | The dashboard, for browser suites |
| `QA_SKIP_UI` | unset | `1` skips the browser suites |

```sh
QA_API_URL=https://talkzen.tech/api/v1 QA_SKIP_UI=1 sh run-all.sh
```

Running against production registers real workspaces and real visitor rows. It is the only way
to catch things that only break behind nginx — a Socket.IO path that never reaches the server,
a proxy header the API reads from the wrong end — so it is worth doing after a deploy, knowing
it leaves test data behind.

## What counts as a pass

A suite passes only if it **exits 0** *and* prints an `N/N passed` line whose two numbers match.
A suite that crashes, cannot find a module, or dies before its summary is a failure, even
though it printed no `FAIL` lines. Silence is not success.

## Writing a new one

Start from `lib/harness.js`, which gives you:

- `client(ip)` — an HTTP caller that claims one address, so your suite does not eat another
  suite's rate-limit allowance. Give every suite its own.
- `newWorkspace(call, label)` — a fresh workspace, owner and widget key, so suites never share
  state.
- `results()` — `check(name, passed, info)`, `note(text)`, and `finish()`, which prints the
  summary line the runner looks for and sets the exit code.
- `waitFor(predicate)` — poll until something is true instead of sleeping a guessed amount.
- `visitorIp(index)` — a routable public address per simulated visitor. Reserved ranges such as
  `203.0.113.x` are rejected as non-public by the API, so they all collapse into one bucket and
  a burst test silently measures nothing.

Name the check after the behaviour a person cares about, not the function under test, and pass
`info` on every check — it is what you read when one fails at three in the morning.

Rate limits are real here. A suite that fires more than sixty widget sessions a minute from one
address **should** start seeing `429`s; if yours does not, it is probably not testing what you
think it is.
