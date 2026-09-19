/**
 * The Customer SDK: the chat, without our chat window.
 *
 * Teams who want their own interface (inside their app, their own design, a mobile web view)
 * load this instead of widget.js and draw the messages themselves. It handles the session,
 * the conversation, sending, and the live connection — the parts that are easy to get wrong.
 *
 * Served from GET /api/v1/customer-sdk.js.
 */
export function buildCustomerSdk(): string {
  return `/* LiveChat Customer SDK */
(function (global) {
  "use strict";

  function LiveChatCustomer(options) {
    if (!(this instanceof LiveChatCustomer)) {
      return new LiveChatCustomer(options);
    }

    options = options || {};

    if (!options.widgetKey) {
      throw new Error("LiveChatCustomer needs a widgetKey");
    }

    this.widgetKey = options.widgetKey;
    this.apiUrl = (options.apiUrl || defaultApiUrl()).replace(/\\/$/, "");
    this.sessionToken = null;
    this.conversationId = null;
    this.socket = null;
    this.handlers = { message: [], typing: [], status: [], error: [] };
  }

  /** Where this script came from, so apps usually need no apiUrl at all. */
  function defaultApiUrl() {
    var script = document.currentScript;
    var src = script ? script.src : "";
    var match = /^(.*\\/api\\/v1)\\//.exec(src);

    return match ? match[1] : "/api/v1";
  }

  LiveChatCustomer.prototype.on = function (event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }

    return this;
  };

  LiveChatCustomer.prototype.emit = function (event, payload) {
    (this.handlers[event] || []).forEach(function (handler) {
      try {
        handler(payload);
      } catch (error) {
        /* a broken handler must not stop the chat */
      }
    });
  };

  LiveChatCustomer.prototype.request = function (path, body, method) {
    return fetch(this.apiUrl + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (error) { data = text; }

        if (!response.ok) {
          var message = (data && data.error && data.error.message) || "Request failed";
          throw new Error(message);
        }

        return data;
      });
    });
  };

  /** Read the widget's public settings (name, welcome message, colours, office hours). */
  LiveChatCustomer.prototype.config = function () {
    return this.request("/widgets/public/" + encodeURIComponent(this.widgetKey) + "/config");
  };

  /** Start (or resume) a visitor session. Call this once before sending anything. */
  LiveChatCustomer.prototype.start = function (visitor) {
    var self = this;
    visitor = visitor || {};

    return this.request("/widgets/public/" + encodeURIComponent(this.widgetKey) + "/sessions", {
      pageUrl: visitor.pageUrl || (global.location ? global.location.href : ""),
      visitorExternalId: visitor.externalId,
      name: visitor.name,
      email: visitor.email
    }).then(function (session) {
      self.sessionToken = session.sessionToken;
      self.emit("status", { connected: false, session: true });

      return session;
    });
  };

  /** Send a message. The first one opens the conversation. */
  LiveChatCustomer.prototype.send = function (body, extra) {
    var self = this;
    extra = extra || {};

    if (!this.sessionToken) {
      return Promise.reject(new Error("Call start() before send()"));
    }

    if (!this.conversationId) {
      return this.request("/widgets/public/" + encodeURIComponent(this.widgetKey) + "/conversations", {
        sessionToken: this.sessionToken,
        body: body,
        name: extra.name,
        email: extra.email
      }).then(function (result) {
        self.conversationId = result.conversation.id;
        self.connect();

        return result.message;
      });
    }

    return this.request(
      "/widgets/public/" + encodeURIComponent(this.widgetKey) + "/conversations/" +
        encodeURIComponent(this.conversationId) + "/messages",
      { sessionToken: this.sessionToken, body: body }
    );
  };

  /** Everything said so far, for when the customer reopens your interface. */
  LiveChatCustomer.prototype.messages = function () {
    if (!this.conversationId || !this.sessionToken) {
      return Promise.resolve([]);
    }

    return this.request(
      "/widgets/public/" + encodeURIComponent(this.widgetKey) + "/conversations/" +
        encodeURIComponent(this.conversationId) + "/messages?sessionToken=" +
        encodeURIComponent(this.sessionToken)
    );
  };

  /** Tell the agent the customer is typing. */
  LiveChatCustomer.prototype.typing = function (isTyping) {
    if (this.socket && this.conversationId) {
      this.socket.emit("typing.update", {
        conversationId: this.conversationId,
        isTyping: isTyping !== false
      });
    }
  };

  /** Rate the chat once it is over. */
  LiveChatCustomer.prototype.rate = function (rating, comment) {
    if (!this.conversationId || !this.sessionToken) {
      return Promise.reject(new Error("There is no conversation to rate"));
    }

    return this.request(
      "/widgets/public/" + encodeURIComponent(this.widgetKey) + "/conversations/" +
        encodeURIComponent(this.conversationId) + "/rate",
      { sessionToken: this.sessionToken, rating: rating, comment: comment }
    );
  };

  /**
   * Open the live connection. Needs socket.io-client on the page; without it the SDK still
   * works, it just polls nothing — messages you send are delivered, replies arrive on reload.
   */
  LiveChatCustomer.prototype.connect = function () {
    var self = this;

    if (this.socket || !global.io || !this.sessionToken) {
      return this;
    }

    var base = this.apiUrl.replace(/\\/api\\/v1$/, "");

    this.socket = global.io(base + "/chat", {
      transports: ["websocket"],
      auth: { sessionToken: this.sessionToken, widgetKey: this.widgetKey }
    });

    this.socket.on("chat.ready", function () {
      self.emit("status", { connected: true, session: true });

      if (self.conversationId) {
        self.socket.emit("conversation.join", { conversationId: self.conversationId });
      }
    });

    this.socket.on("message.created", function (payload) {
      if (payload && payload.message) {
        self.emit("message", payload.message);
      }
    });

    this.socket.on("typing.updated", function (payload) {
      self.emit("typing", payload);
    });

    this.socket.on("chat.error", function (payload) {
      self.emit("error", payload);
    });

    this.socket.on("disconnect", function () {
      self.emit("status", { connected: false, session: true });
    });

    return this;
  };

  LiveChatCustomer.prototype.disconnect = function () {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    return this;
  };

  global.LiveChatCustomer = LiveChatCustomer;
})(typeof window !== "undefined" ? window : this);
`;
}
