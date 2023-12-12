import { User } from "./index.types";
import { randomUUID } from "crypto";



const users = new Map<string, User>(
    [
        { id: randomUUID(), name: "John", email: "john@email.com" },
        { id: randomUUID(), name: "Jane", email: "jane@email.com" }
    ].map(
        user => [user.id, user])
);


export function createUser(User: Omit<User, "id">) {
    const id = randomUUID();
    const user = { ...User, id };
    users.set(id, user);

    return user;
}

export function updateUser(user: User) {
    const updUser = {
        ...users.get(user.id),
        ...user,
    }
    users.set(user.id, updUser);

    return updUser;
}

export function getUser(id: string) {
    return users.get(id);
}

export function deleteUser(id: string) {
    users.delete(id);
}

export function listUsers() {
    return Array.from(users.values());
}