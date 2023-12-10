import { logger } from "@bogeychan/elysia-logger";
import { html as htmlPlugin } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Stream as ElysiaStream } from '@elysiajs/stream';
import * as elements from "@kitajs/html";
import { randomUUID } from "crypto";
import { Elysia, t } from "elysia";
import { Duplex } from 'node:stream';
import dedent from "ts-dedent";

const CONNECTED_USERS_CHANGED_EVENT = "connected-users:change"

class UserStream extends Duplex {
  private nUsers = 0;

  public get users() {
    return this.nUsers;
  }

  public connectUser() {
    this.nUsers++;
    this.emit(CONNECTED_USERS_CHANGED_EVENT);
  }

  public disconnectUser() {
    if (this.nUsers > 0) {
      this.nUsers--;
    }
    this.emit(CONNECTED_USERS_CHANGED_EVENT);
  }

  public addOnChangeListener(cb: () => void) {
    this.on(CONNECTED_USERS_CHANGED_EVENT, cb);
  }

  public removeOnChangeListener(cb: () => void) {
    this.off(CONNECTED_USERS_CHANGED_EVENT, cb);
  }
}

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
  .get("/", ({ html, authenticated }) => html(<LandingPage authenticated={authenticated} />))
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
  .get("/login", ({ html, query: { next }, authenticated, redirect }) => {
    if (authenticated) {
      return redirect("/users");
    }
    const nextUrl = next ? `?next=${next}` : "";
    return html(<LoginPage nextUrl={nextUrl} />);
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
    error({ set, html }) {
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
    .get("/users", ({ html }) =>
      html(<UserPage />)
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

function BaseHtml({ children }: elements.PropsWithChildren) {
  return (dedent`
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HTML-is-DEAD</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
      <link rel="stylesheet" href="/static/css/style.css">
      <script src="https://unpkg.com/htmx.org@1.9.9"></script>
      <script defer src="https://unpkg.com/htmx.org/dist/ext/debug.js"></script>
      <script defer src="https://unpkg.com/htmx.org/dist/ext/response-targets.js"></script>
    </head>

    ${children}  
    </html>
  `)
}

// TODO: try to send the header hx-push-url to set the section url in the browser
function Body({ children, authenticated }: elements.PropsWithChildren<{ authenticated?: boolean }>) {
  return (
    <body class="bg-dark text-light" hx-ext="debug, response-targets">
      <header>
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
          <div class="container-fluid">
            <a class="navbar-brand" href="/">HTML is 💀</a>
            {
              authenticated &&
              <>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                  aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                  <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                  <ul class="navbar-nav w-100">
                    <li class="nav-item">
                      <a class="nav-link active" aria-current="page" href="/users">Users&nbsp;<span class="bi bi-people-fill"></span></a>
                    </li>
                    <li class="nav-item d-flex flex-row flex-grow-1 justify-content-lg-end">
                      <a class="btn btn-danger text-light" aria-current="page" hx-trigger="click" hx-post="/logout">Logout&nbsp;<span class="bi bi-box-arrow-right"></span></a>
                    </li>
                  </ul>
                </div>
              </>
            }
          </div>
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer class="footer">
        <div class="container text-center p-3">
          <div class="row">
            <div class="col" hx-sse={`connect:/users/connected swap:${CONNECTED_USERS_CHANGED_EVENT}`}>
              <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col">Copyright © 2023 Telefónica.</div>
          </div>
        </div>
      </footer>
    </body >
  )
}

function LandingPage({ authenticated }: { authenticated?: boolean }) {
  return (
    <BaseHtml>
      <Body authenticated={authenticated}>
        <section class="d-flex flex-column justify-content-center align-items-center w-100 h-100">
          <h1 class="bg-dark text-light">💀 HTML is dead, long live HTMX</h1>
          {!authenticated && <a class="btn btn-primary btn-lg" href="/login">Login</a>}
        </section>
      </Body>
    </BaseHtml>
  )
}

function LoginPage({ nextUrl = "" }) {
  return (
    <BaseHtml>
      <Body>
        <section class="d-flex flex-column justify-content-center align-items-center w-100 h-100">
          <form
            hx-post={"/login" + nextUrl}
            hx-target-error="find [data-errors]"
          >
            <div class="mb-3">
              <label for="email" class="form-label">Email address</label>
              <input type="email" name="email" class="form-control" id="email" aria-describedby="emailHelp" />
              <div id="emailHelp" class="form-text text-light">We'll never share your email with anyone else.</div>
            </div>
            <div class="mb-3">
              <label for="password" class="form-label">Password</label>
              <input type="password" name="password" class="form-control" id="password" />
            </div>
            <div class="mb-3 text-danger" data-errors></div>
            <button type="submit" class="btn btn-primary">Login</button>
          </form>
        </section>
      </Body>
    </BaseHtml>
  )
}

function UserPage() {
  return (
    <BaseHtml>
      <Body authenticated>
        <section class="container container-fluid p-3">
          <div class="row justify-content-end">
            <div class="col-12 d-flex justify-content-end">
              <CreateUserButton />
            </div>
          </div>
          <div class="row gap-2">
            <UsersTable />
          </div>
        </section>
        <UserModalContainer />
      </Body>
    </BaseHtml>
  )
}

function CreateUserButton() {
  return (
    <button
      type="button"
      class="btn btn-primary"
      data-bs-toggle="modal"
      data-bs-target="#user-modal"
      hx-get="/_components/users/new"
      hx-target="#user-modal-dialog"
      hx-swap="innerHTML"
    >
      Create User&nbsp;<i class="bi bi-clipboard2-plus-fill"></i>
    </button>
  )
}

function UsersTable() {
  const users = listUsers()
  return (
    <>
      <table id="users-table" class="table table-dark">
        <thead>
          <tr>
            <th class="col">Name&nbsp;<i class="bi bi-people-fill"></i></th>
            <th class="col">Email&nbsp;<i class="bi bi-box-seam-fill"></i></th>
            <th class="col-2"></th>
          </tr>
        </thead>
        <UsersTableBody id="users-table-body" users={users} />
      </table>
    </>
  )
}

function UsersTableBody({ id, users }: { id: string, users: User[] }) {
  return (
    <tbody id={id}>
      {users.map(user => (
        <UsersTableRow {...user} />
      ))}
    </tbody>
  )
}

function UsersTableRow({ id, name, email }: User) {
  return (
    <tr id={"users-table-row-" + id}>
      <td>{name}</td>
      <td>{email}</td>
      <td>
        <UsersTableRowActions id={id} />
      </td>
    </tr>
  )
}

function UsersTableRowActions({ id }: Partial<User>) {
  return (
    <div class="d-flex gap-2 justify-content-end">
      <button
        type="button"
        class="btn btn-primary"
        data-bs-toggle="modal"
        data-bs-target="#user-modal"
        hx-get={`/_components/users/update/${id}`}
        hx-target="#user-modal-dialog"
        hx-swap="innerHTML"
      >
        Edit&nbsp;<i class="bi bi-pencil-fill"></i>
      </button>
      <button
        type="button"
        class="btn btn-danger"
        hx-delete={`/users/${id}`}
        hx-target={`#users-table-row-${id}`}
        hx-swap="delete"
      >
        Delete&nbsp;<i class="bi bi-trash-fill"></i>
      </button>
    </div>
  )
}

function CreateUserDialog() {
  return (
    <form
      autocomplete="off"
      hx-post="/users"
      hx-target="#users-table-body"
      hx-swap="beforeend"
      hx-target-error="find [data-errors]"
    >
      <div class="modal-content text-dark">
        <div class="modal-header">
          <h5 class="modal-title" id="user-modal-label">Create User</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="user-modal-body">
          <div class="container">
            <div class="row">
              <div class="col-md-12">
                <label for="input-name" class="form-label">Name</label>
                <input type="text" class="form-control" id="input-name" name="name" placeholder="Name" />
              </div>
            </div>
            <div class="row">
              <div class="col-md-12">
                <label for="input-email" class="form-label">Email</label>
                <input type="text" class="form-control" id="input-email" name="email" placeholder="Email" />
              </div>
            </div>
            <div class="row">
              <div class="col-md-12 text-danger-emphasis" data-errors></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary">Create User</button>
        </div>
      </div>
    </form>
  )
}

function UpdateUserDialog({ ...user }: User) {
  return (
    <form
      autocomplete="off"
      hx-put={`/users/${user.id}`}
      hx-target={`#users-table-row-${user.id}`}
      hx-target-error="find [data-errors]"
    >
      <input type="hidden" name="id" value={user.id} />
      <div class="modal-content text-dark">
        <div class="modal-header">
          <h5 class="modal-title" id="user-modal-label">Update User</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="user-modal-body">
          <div class="container">
            <div class="row">
              <div class="col-md-12">
                <label for="input-name" class="form-label">Name</label>
                <input type="text" class="form-control" id="input-name" name="name" placeholder="Name" value={user.name} />
              </div>
            </div>
            <div class="row">
              <div class="col-md-12">
                <label for="input-email" class="form-label">Email</label>
                <input type="text" class="form-control" id="input-email" name="email" placeholder="Email" value={user.email} />
              </div>
            </div>
            <div class="row">
              <div class="col-md-12 text-danger-emphasis" data-errors></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary">Save changes</button>
        </div>
      </div>
    </form>
  )
}

function UserModalContainer() {
  return (
    <>
      <div class="modal fade text-reset" id="user-modal" tabindex="-1" aria-labelledby="user-modal-label" aria-hidden="true">
        <div class="modal-dialog" id="user-modal-dialog"></div>
        <script>
          {
            `
            document.body.addEventListener("closeModal", function(event) {
              var modalElement = document.querySelector("#user-modal"); // replace with your modal id
              var bootstrapModal = bootstrap.Modal.getInstance(modalElement);
              bootstrapModal.hide();
            });
            `
          }
        </script>
      </div>
    </>
  )
}

interface User {
  id: string;
  name: string;
  email: string;
}

const users = new Map<string, User>(
  [
    { id: randomUUID(), name: "John", email: "john@email.com" },
    { id: randomUUID(), name: "Jane", email: "jane@email.com" }
  ].map(
    user => [user.id, user])
);


function createUser(User: Omit<User, "id">) {
  const id = randomUUID();
  const user = { ...User, id };
  users.set(id, user);

  return user;
}

function updateUser(user: User) {
  const updUser = {
    ...users.get(user.id),
    ...user,
  }
  users.set(user.id, updUser);

  return updUser;
}

function getUser(id: string) {
  return users.get(id);
}

function deleteUser(id: string) {
  users.delete(id);
}

function listUsers() {
  return Array.from(users.values());
}
