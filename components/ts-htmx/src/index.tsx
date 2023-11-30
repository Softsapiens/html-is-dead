import { html as htmlPlugin } from '@elysiajs/html';
import { staticPlugin } from "@elysiajs/static";
import { Elysia, t } from "elysia";
import dedent from 'ts-dedent';
import * as elements from "@kitajs/html";
import { randomUUID } from 'crypto';

const app = new Elysia()
  .use(htmlPlugin())
  .onRequest(({ request, set }) => {
    const path = new URL(request.url).pathname;

    if (
      !(
        path === '/' ||
        path === '/login' ||
        path === '/logout' ||
        path === '/signin' ||
        path === '/static'
      )
    ) {
      console.log('onRequest catched', request);

      // Get cookies from request
      const cookies = request.headers.get('cookie');
      const session = cookies?.split(';').find(cookie => cookie.startsWith(' session='));

      if (!session) {
        set.redirect = '/login?back=' + encodeURI(new URL(request.url).pathname);
        set.status = 302;
        // Respond with redirect
        return request;
      }
    } else {
      console.log('onRequest bypass', request);
    }
  })
  .get('/logout', ({ set, cookie: { session } }) => {
    set.redirect = '/';
    set.status = 302;
    session.remove();
  })
  .get('/login', ({ html, query: { back }, headers }) => {

    return html(
      <WrapHx cond={headers['hx-request'] === 'true' || false}>
      
        <div>Login</div>
        <form action={"/signin?back=" + back} method="post">
          <input type="text" name="username" />
          <input type="password" name="password" />
          <button type="submit">Sign in</button>
        </form>
      
      </WrapHx>
    );
  })
  .post('/signin', ({ request, body, query: { back }, set, cookie: { session } }) => {
    set.redirect = decodeURI(back || '/');
    set.status = 302;

    // Validate user/password from body and set session cookie
    session.value = '123';

    return request;
  })
  // }, {
  //   cookie: t.Cookie({
  //     value: t.String(),
  //   })
  // })
  .get("/", ({ html }) => html(
    <BaseHtml>
      <Body>
      </Body>
    </BaseHtml>
  ))
  .get("/users", ({ html, headers }) =>
    html(
      <WrapHx cond={headers['hx-request'] === 'true' || false}>
        <User />
      </WrapHx>
    )
  )
  .post("/users", ({ html, body, headers }) => {
    const user = createUser(
      {
        name: body.name,
        email: body.email
      }
    )

    return html(<UsersTableRow {...user} />)
  }, {
    type: 'formdata',
    body: t.Object({
      // id: t.Optional(t.String()),
      name: t.String(),
      email: t.String(),
    })
  })
  .put("/users", ({ html, body }) => {
    const user = updateUser(
      {
        id: body.id,
        name: body.name,
        email: body.email
      }
    )

    console.log(user);

    return html(<UsersTableRow {...user} />)
  }, {
    type: 'formdata',
    body: t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })
  }
  )
  .patch("/users/:id", ({ html, params }) => {
    const user = getUser(params.id);
  })
  .delete("/users/:id", ({ html, params }) => {
    const user = deleteUser(params.id);
  })
  .get('/users/update/:id', ({ html, params }) => {
    const user = getUser(params.id);
    if (!user) {
      throw new Error('User not found');
    }
    return html(<UserDialogUpdate {...user} />)
  })
  .get('/users/new', ({ html }) => html(<UserDialogCreate />))
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
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css">
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
      <link rel="stylesheet" href="/static/css/style.css">
      <script src="https://unpkg.com/htmx.org@1.9.9"></script>
    </head>

    ${children}  
    </html>
  `)
}

function WrapHx({ cond, children }: elements.PropsWithChildren & { cond: boolean }) {
  if (cond) {
    return (
      <>
      {children}
      </>);
  } else {
    return (
      <BaseHtml>
        <Body>
          {children}
        </Body>
      </BaseHtml>
    )
  }
}
                  
// TODO: try to send the header hx-push-url to set the section url in the browser
function Body({ children }: elements.PropsWithChildren) {
  return (
    <body class="bg-dark">
      <header>
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
          <div class="container-fluid">
            <a class="navbar-brand" href="/">HTML is 💀</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
              aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
              <ul class="navbar-nav">
                <li class="nav-item">
                  <a class="nav-link active" aria-current="page" href="/users" hx-get="/users" hx-target="main" hx-swap="innerHTML" hx-push-url="/users">Users&nbsp;<i class="bi bi-people-fill"></i></a>
                </li>
                <li class="nav-item">
                  <a class="nav-link active" aria-current="page" href="/logout">Logout&nbsp;<i class="bi bi-people-fill"></i></a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>
      <main>
        <section>
          {children}
        </section>
      </main>
      <footer class="footer text-light">
        <div class="container text-center p-3">
          <div class="row">
            <div class="col">Copyright © 2023 Telefónica.</div>
          </div>
        </div>
      </footer>
    </body>
  )
}

function User() {
  return (
    <>
      <div class="container container-fluid p-3">
        <div class="row justify-content-end">
          <div class="col-12 d-flex justify-content-end">
            <CreateUserButton />
          </div>
        </div>
        <div class="row gap-2">
          <UsersTable />
        </div>
      </div>
      <UserModalContainer />
    </>
  )
}

function CreateUserButton() {
  return (
    <button
      type="button"
      class="btn btn-primary"
      data-bs-toggle="modal"
      data-bs-target="#user-modal"
      hx-get="/users/new"
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
    <tbody id={id} hx-target="closest tr" hx-swap="outerHTML">
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
        hx-get={`/users/update/${id}`}
        hx-target="#user-modal-dialog"
        hx-swap="innerHTML"
      >
        Edit&nbsp;<i class="bi bi-pencil-fill"></i>
      </button>
      <button
        type="button"
        class="btn btn-danger"
        hx-delete={`/users/${id}`}
      >
        Delete&nbsp;<i class="bi bi-trash-fill"></i>
      </button>
    </div>
  )
}

function UserDialogCreate() {
  return (
    <form hx-post="/users" hx-target="#users-table-body" hx-swap="beforeend" autocomplete="off">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="user-modal-label">Create User</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="user-modal-body">
          <div class="container">
            <div class="row">
              <div class="col-md-4">
                <label for="input-name" class="form-label">Name</label>
                <input type="text" class="form-control" id="input-name" name="name" placeholder="Name" />
              </div>
            </div>
            <div class="row">
              <div class="col-md-4">
                <label for="input-email" class="form-label">Email</label>
                <input type="text" class="form-control" id="input-email" name="email" placeholder="Email" />
              </div>
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

function UserDialogUpdate({ ...user }: User) {
  return (
    <form hx-put="/users" hx-target={"#users-table-row-" + user.id} hx-swap="outerHTML" autocomplete="off">
      <input type="hidden" name="id" value={user.id} />
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="user-modal-label">Update User</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="user-modal-body">
          <div class="container">
            <div class="row">
              <div class="col-md-4">
                <label for="input-name" class="form-label">Name</label>
                <input type="text" class="form-control" id="input-name" name="name" placeholder="Name" value={user.name} />
              </div>
            </div>
            <div class="row">
              <div class="col-md-4">
                <label for="input-email" class="form-label">Email</label>
                <input type="text" class="form-control" id="input-email" name="email" placeholder="Email" value={user.email} />
              </div>
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
      <div class="modal fade" id="user-modal" tabindex="-1" aria-labelledby="user-modal-label" aria-hidden="true">
        <div class="modal-dialog" id="user-modal-dialog"></div>
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
    { id: randomUUID(), name: 'John', email: 'john@email.com' },
    { id: randomUUID(), name: 'Jane', email: 'jane@email.com' }
  ].map(
    user => [user.id, user])
);


function createUser(User: Omit<User, 'id'>) {
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