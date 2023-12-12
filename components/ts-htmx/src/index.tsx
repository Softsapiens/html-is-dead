import { logger } from "@bogeychan/elysia-logger";
import { html as htmlPlugin } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Stream as ElysiaStream } from '@elysiajs/stream';
import * as elements from "@kitajs/html";
import { Elysia, t } from "elysia";
import { CreateUserDialog, LandingPage, LandingPartial, LoginPage, LoginPartial, UpdateUserDialog, UserPage, UserPartial, UsersTable, UsersTableRow } from "./components";
import { UserStream } from "./stream";
import { CONNECTED_USERS_CHANGED_EVENT } from "./stream";
import { createUser, updateUser, getUser, deleteUser } from "./users";


const app = new Elysia()
  .use(logger({ level: "debug" }))
  .use(htmlPlugin())
  .state("usersStream", new UserStream({}))
  .derive(function ({ set, headers, cookie: { session } }) {
    return {
      authenticated: session?.value != null,
      redirect(url: string) {
        if (headers["hx-request"] === "true") {
          set.headers["hx-redirect"] = url;
          set.headers["hx-refresh"] = "true";
          set.headers["hx-replace"] = "true";
        } else {
          set.redirect = url;
        }
        return '';
      }
    }
  })
  .get("/", ({ html, authenticated, headers }) => 
  (headers["hx-request"]==="true") ? html(<LandingPartial authenticated={authenticated} />) : html(<LandingPage authenticated={authenticated} />))
  .get("/users/connected", ({ request, log, store: { usersStream } }) => {
    return new ElysiaStream(async (stream) => {
      log.info("User connected");
      function sendUsers() {
        stream.send(<div>Users connected {usersStream.users}&nbsp;<i class="bi bi-people-fill"></i></div>);
      }
      usersStream.addOnChangeListener(sendUsers);
      usersStream.connectUser();
      request.signal.addEventListener("abort", () => {
        usersStream.removeOnChangeListener(sendUsers);
        usersStream.disconnectUser();
        stream.close();
        log.info("User disconnected");
      })
    }, { event: CONNECTED_USERS_CHANGED_EVENT });
  })
  .get("/login", ({ html, query: { next }, authenticated, redirect, headers }) => {
    if (authenticated) {
      return redirect("/users");
    }
    const nextUrl = next ? `?next=${next}` : "";
    
    return (headers["hx-request"]==="true") ? html(<LoginPartial nextUrl={nextUrl} />) : html(<LoginPage nextUrl={nextUrl} />);
  }, {
    beforeHandle({ authenticated, redirect }) {
      if (authenticated) {
        return redirect("/users");
      }
    },
    cookie: t.Optional(t.Cookie({
      session: t.Optional(t.String()),
    }))
  })
  .post("/login", ({ query: { back: next }, cookie: { session }, redirect }) => {
    session.set({ value: "asdf" });
    return redirect(next ? decodeURI(next) : "/users");
  }, {
    cookie: t.Cookie({
      session: t.Optional(t.String()),
    }),
    type: "formdata",
    body: t.Object({
      email: t.String({
        format: "email",
      }),
      password: t.String({
        minLength: 3,
      }),
    }),
    error({ set }) {
      set.status = 400;
      return 'Invalid credentials';
    }
  })
  .all("/logout", ({ cookie: { session }, redirect }) => {
    session.remove();
    return redirect("/login");
  }, {
    cookie: t.Cookie({
      session: t.Optional(t.String()),
    })
  })
  .guard({
    beforeHandle({ request, cookie: { session }, log, redirect }) {
      const path = new URL(request.url).pathname;
      if (!session.value) {
        log.info("User not authenticated")
        const targetPath = path.includes("/users") ? "/users" : path;
        const loginUrl = "/login?next=" + encodeURI(targetPath);
        return redirect(loginUrl);
      }
    },
    cookie: t.Cookie({
      session: t.Optional(t.String()),
    })
  }, (app) => app
    .get("/users", ({ html, headers }) =>
      (headers["hx-request"]==="true") ? html(<UserPartial />) : html(<UserPage />)
    )
    .post("/users", ({ body, set, html }) => {
      const user = createUser({ name: body.name, email: body.email })
      set.headers["hx-trigger"] = "closeModal";
      return html(<UsersTableRow {...user} />)
    }, {
      type: "formdata",
      body: t.Object({
        name: t.String({
          minLength: 3,
        }),
        email: t.String({
          format: "email",
        }),
      }),
    })
    .put("/users/:userId", ({ body, params: { userId }, set, html }) => {
      const id = userId;
      const user = updateUser({ id, name: body.name, email: body.email })
      set.headers["hx-trigger"] = "closeModal, usersChanged";

      return html(<UsersTableRow {...user} />)
    }, {
      type: "formdata",
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        name: t.String({
          minLength: 3,
        }),
        email: t.String({
          format: "email",
        }),
      }),
    })
    .delete("/users/:id", ({ params, set }) => {
      const user = getUser(params.id);
      if (!user) {
        throw new Error("User not found");
      }
      deleteUser(params.id);
    }, {
      error({ set }) {
        set.status = 404;
        return 'User not found';
      }
    })
    .get("/_components/users/table", ({ html }) => {
      return html(<UsersTable />)
    })
    .get("/_components/users/update/:id", ({ html, params }) => {
      const user = getUser(params.id);
      if (!user) {
        throw new Error("User not found");
      }
      return html(<UpdateUserDialog {...user} />)
    })
    .get("/_components/users/new", ({ html }) => html(<CreateUserDialog />))
  )

  .use(staticPlugin({ assets: "static", prefix: "/static" }))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.url}`
);
