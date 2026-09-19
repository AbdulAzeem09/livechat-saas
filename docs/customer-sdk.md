# Customer SDK

For teams who want the chat but not our chat window — inside their own app, in their own
design, or in a mobile web view. The SDK handles the session, the conversation, sending and
the live connection; you draw everything the customer sees.

If you just want a chat on a website, use the widget instead (Settings → Install LiveChat).
This is the harder path, on purpose.

## Load it

```html
<!-- optional: without it the SDK still sends and fetches, it just isn't live -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script src="https://your-domain.com/api/v1/customer-sdk.js"></script>
```

The SDK works out the API address from its own `src`, so nothing else is usually needed.

## Use it

```js
const chat = new LiveChatCustomer({ widgetKey: "lcw_your_widget_key" });

chat.on("message", (message) => {
  // draw it however you like
  render(message.senderType === "VISITOR" ? "me" : "them", message.body);
});

chat.on("typing", () => showTypingDots());
chat.on("status", ({ connected }) => setOnlineIndicator(connected));
chat.on("error", ({ message }) => showError(message));

// once, before sending anything
await chat.start({ name: "Sara", email: "sara@example.com" });

// the first send opens the conversation and connects the socket
await chat.send("Do you deliver to Lahore?");
```

## What it gives you

| Method | What it does |
|---|---|
| `config()` | The widget's public settings — name, welcome message, colours, office hours |
| `start(visitor)` | Opens a visitor session. `{ name, email, externalId, pageUrl }`, all optional |
| `send(text)` | Sends a message; the first one creates the conversation |
| `messages()` | Everything said so far, for when the customer reopens your interface |
| `typing(true/false)` | Tells the agent the customer is typing |
| `rate(rating, comment)` | Post-chat rating: `"good"` or `"bad"` |
| `connect()` / `disconnect()` | The live connection (called for you on first send) |

| Event | When |
|---|---|
| `message` | A message arrived (from the agent, the chatbot, or your own echo) |
| `typing` | The agent started or stopped typing |
| `status` | `{ connected, session }` changed |
| `error` | The server refused something — show it and let the customer retry |

## Things worth knowing

- **The widget key is public.** It identifies the widget, it does not authenticate anyone;
  keep the allowed-domains list in Settings → Security tight.
- **One session per visitor.** Keep the SDK instance alive while your interface is open; on a
  fresh page load call `start()` again.
- **Without socket.io on the page** everything still works, but replies only appear when you
  call `messages()` — so load socket.io unless you have a reason not to.
- **Rate limits** are per IP, the same as the widget: a session, twenty new conversations and
  sixty messages per window.
