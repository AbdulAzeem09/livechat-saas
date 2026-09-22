# Chat widget JS API

Once the widget script is on the page it puts `window.LiveChatSaaS` there too. Everything
below is safe to call immediately — the widget queues what it has to.

```html
<script async src="https://your-domain.com/api/v1/widget.js" data-widget-key="lcw_..."></script>
```

## Opening and closing

```js
LiveChatSaaS.open();     // open the panel on the chat
LiveChatSaaS.close();    // close it (the bubble stays)
LiveChatSaaS.toggle();
LiveChatSaaS.isOpen();   // → true / false

LiveChatSaaS.hide();     // take the bubble off the page entirely
LiveChatSaaS.show();     // put it back
```

`hide()` is for sites that have their own chat button and don't want the floating bubble.

## Chat buttons

Any element on the page marked `data-livechat-button` opens the chat when clicked — a button,
a link, an image, a menu item:

```html
<button data-livechat-button>Chat with us</button>
<a href="#" data-livechat-button>Talk to sales</a>
```

The widget keeps `data-livechat-status` on each one, set to `online` or `offline` according
to the same working hours the bubble uses, so you can style closed hours:

```css
[data-livechat-button][data-livechat-status="offline"] { opacity: .5; }
```

Buttons added to the page later (by a framework, a modal, an infinite list) are picked up
automatically. To force a re-scan after changing the DOM yourself:

```js
LiveChatSaaS.refreshButtons();
```

## Telling us who the visitor is

When your site already knows who they are, pass it along and they won't be asked again:

```js
LiveChatSaaS.setCustomer({
  name: "Sara Khan",
  email: "sara@example.com",
  id: "user_8812"          // your own id for them, optional
});
```

Given both a name and an email, the pre-chat form is skipped.

## Starting a chat from your own UI

```js
LiveChatSaaS.sendMessage("I'd like to ask about the blue kettle");
```

Opens the chat and sends that as the visitor's first message — useful on an "Ask about this
product" button.

## Recording a sale

```js
LiveChatSaaS.trackSale(49.90, "USD", "ORD-4417");
```

The sale is attributed to the chat that was open, and shows up in **Reports → Ecommerce**.

## Events

```js
const off = LiveChatSaaS.on("chatStarted", (event) => {
  console.log("chat id", event.conversationId);
});

off(); // stop listening
```

| Event | Fires when | You get |
| --- | --- | --- |
| `chatStarted` | The visitor's first message creates a chat | `{ conversationId }` |
| `message` | Any message is drawn, either side | `{ id, from, text, agent }` |
| `opened` | The panel opens | `{}` |
| `closed` | The panel closes | `{}` |

`from` is `"visitor"` or `"agent"`. On an agent message, `agent` carries `{ name, title,
avatarUrl }` — the same name shown in the chat. It is never the agent's email.

A handler that throws is ignored, so a bug in your page can't break the chat.
