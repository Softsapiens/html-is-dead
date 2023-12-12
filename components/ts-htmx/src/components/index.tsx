import * as elements from "@kitajs/html";
import dedent from "ts-dedent";
import { CONNECTED_USERS_CHANGED_EVENT } from "../stream";
import { listUsers } from "../users";
import type { User } from "../users";

export function BaseHtml({ children }: elements.PropsWithChildren) {

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
      ${ (process.env.NODE_ENV==="development") ? <script>
        htmx.logAll();
      </script> : ""
      }
    </head>

    ${children}  
    </html>
  `)
}

// TODO: try to send the header hx-push-url to set the section url in the browser
export function Body({ children, authenticated }: elements.PropsWithChildren<{ authenticated?: boolean }>) {
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
            <div class="col">Copyright © 2023 TEFCON.</div>
          </div>
        </div>
      </footer>
    </body >
  )
}

export function LandingPage({ authenticated }: { authenticated?: boolean }) {
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

export function LoginPage({ nextUrl = "" }) {
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

export function UserPage() {
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

export function CreateUserButton() {
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

export function UsersTable() {
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

export function UsersTableBody({ id, users }: { id: string, users: User[] }) {
  return (
    <tbody id={id}>
      {users.map(user => (
        <UsersTableRow {...user} />
      ))}
    </tbody>
  )
}

export function UsersTableRow({ id, name, email }: User) {
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

export function UsersTableRowActions({ id }: Partial<User>) {
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
        hx-confirm="Are you sure to delete the user?"
        hx-trigger="confirmed"
        hx-target={`#users-table-row-${id}`}
        hx-swap="delete"
      >
        Delete&nbsp;<i class="bi bi-trash-fill"></i>
      </button>
    </div>
  )
}

export function CreateUserDialog() {
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

export function UpdateUserDialog({ ...user }: User) {
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

export function UserModalContainer() {
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
