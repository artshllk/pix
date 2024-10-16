import Route from '@ember/routing/route';
import { service } from '@ember/service';

export default class UserAccountRoute extends Route {
  @service currentUser;

  model() {
    return this.currentUser.user;
  }
}
