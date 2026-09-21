# AI agent

The assistant that answers visitors when nobody on the team has picked up the chat yet. It
answers from the workspace's knowledge base, follows the rules the workspace wrote for it, and
steps aside the moment a person joins.

Turn it on in **Automate → Knowledge hub → AI receptionist**, set to `auto`. In `suggest` it
stays quiet and only drafts replies for agents; in `off` it falls back to plain keyword
matching against published articles.

## Skills — the rules it follows

**Automate → AI skills.** A skill is one instruction, written the way you would brief a new
colleague:

> Never promise a refund. Take the order number and hand the chat to a person.

Skills go into the prompt ahead of everything else, so they override how the assistant would
otherwise answer. The screen ships with four examples (refunds, price questions, order
tracking, complaints) that fill the form in one click.

### Keywords decide when a rule is used

A skill with keywords (`refund, money back, return`) is only sent to the model when the
visitor's message mentions one of them. A skill with no keywords applies to every message —
use those for house style ("keep answers under three sentences").

This matters once a workspace has more than a handful of rules: sending all of them on every
message makes the model worse at following any of them. At most **8** skills reach the model
for a single message (keyword matches first, then the always-on ones), and a workspace can
store **50**.

Keywords are lowercased, de-duplicated, and anything shorter than two characters is dropped.
Matching is a plain substring check against the lowercased message — no stemming, so add the
plural yourself if you want it.

### Switching off vs removing

**Switch off** keeps the rule but stops sending it to the model — useful while you work out
whether a rule is helping. **Remove** deletes it.

## When the team is offline

If no agent is marked `ONLINE`, the assistant says so plainly, asks for a name and an email or
phone number, and confirms once the visitor gives it. This runs even with an empty knowledge
base — an out-of-hours visitor gets a lead captured instead of silence.

## Counting what it actually did

**Automate → AI skills** shows four numbers, also available at
`GET /organizations/:id/ai/performance?days=30`:

| Number | What it means |
| --- | --- |
| Finished on its own | Chats closed without a single message from a human agent |
| Chats it answered | Chats the assistant said anything in |
| Done without a person | The first as a percentage of the second |
| Handed to a person | Chats where the assistant stepped aside for an agent |

A chat is judged once, when it is resolved or closed: if the assistant posted at least one
message and no agent posted any, it counts as finished by the assistant. The verdict is stored
on the conversation, so the report is a count rather than a scan of every message ever sent.

The judgement is deliberately strict in one direction — an agent typing a single word means the
chat does not count. Over-reporting here would be worse than under-reporting: the number exists
to answer "is this assistant worth paying for", and a number that flatters itself is useless.

## Guard rails

- The assistant stops answering after a set number of visitor messages in one chat, and hands
  over to a person.
- Once a visitor asks for a human, the assistant stays out of that chat.
- With no `ANTHROPIC_API_KEY` configured, the assistant never posts anything — the rest of the
  product works unchanged.

## API

All routes are workspace-scoped and refuse another workspace's token with `403`.

| Route | Permission |
| --- | --- |
| `GET /organizations/:id/ai/skills` | `settings:manage` |
| `POST /organizations/:id/ai/skills` | `settings:manage` |
| `PATCH /organizations/:id/ai/skills/:skillId` | `settings:manage` |
| `DELETE /organizations/:id/ai/skills/:skillId` | `settings:manage` |
| `GET /organizations/:id/ai/performance` | `analytics:read` |
