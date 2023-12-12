import { Duplex } from 'node:stream';
import { CONNECTED_USERS_CHANGED_EVENT } from './index.types';

export class UserStream extends Duplex {
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