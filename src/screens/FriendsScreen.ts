import type { FriendAction, FriendPerson, FriendsView } from '../api/friends';

export type FriendsScreenHandlers = {
  onEnabled: () => Promise<boolean>;
  onPage: (view: FriendsView, offset: number) => Promise<{ items: FriendPerson[]; hasMore: boolean }>;
  onSearch: (query: string) => Promise<FriendPerson[]>;
  onConnect: (id: number | string, action: FriendAction) => Promise<void>;
  onOpenProfile: (username: string) => void;
};

const tabs: Array<{ id: FriendsView; title: string }> = [
  { id: 'friends', title: 'Friends' },
  { id: 'requests', title: 'Requests' },
  { id: 'sent', title: 'Sent' },
  { id: 'discover', title: 'Find people' }
];

export class FriendsScreen {
  private view: FriendsView = 'friends';
  private query = '';
  private generation = 0;
  private items: FriendPerson[] = [];
  private offset = 0;
  private hasMore = false;
  private busy = false;
  private notice = '';

  constructor(private readonly content: HTMLElement, private readonly handlers: FriendsScreenHandlers) {}

  deactivate(): void { ++this.generation; this.busy = false; }

  async render(): Promise<void> {
    const generation = ++this.generation;
    this.content.replaceChildren(message('Loading friends…'));
    try {
      const enabled = await this.handlers.onEnabled();
      if (generation !== this.generation) return;
      if (!enabled) {
        this.content.replaceChildren(message('Friends are currently unavailable.'));
        return;
      }
      await this.load(false);
    } catch (error) {
      if (generation === this.generation) this.content.replaceChildren(message(errorText(error)));
    }
  }

  private async load(more: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const generation = this.generation;
    if (!more) {
      this.items = [];
      this.offset = 0;
      this.hasMore = false;
    }
    this.draw();
    try {
      if (this.view === 'discover' && this.query) {
        const results = await this.handlers.onSearch(this.query);
        if (generation !== this.generation) return;
        this.items = results;
        this.hasMore = false; // The engine's search_users method returns its first bounded page.
      } else {
        const page = await this.handlers.onPage(this.view, this.offset);
        if (generation !== this.generation) return;
        this.items = more ? [...this.items, ...page.items] : page.items;
        this.hasMore = page.hasMore;
        this.offset += 1;
      }
      this.notice = '';
    } catch (error) {
      if (generation === this.generation) this.notice = errorText(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.draw();
      }
    }
  }

  private draw(): void {
    const heading = node('h2', 'Friends');
    heading.className = 'friends-heading';
    const tabsBar = document.createElement('nav');
    tabsBar.className = 'friends-tabs';
    tabsBar.setAttribute('aria-label', 'Friends views');
    for (const tab of tabs) {
      const button = node('button', tab.title);
      button.type = 'button';
      button.className = `friends-tab${tab.id === this.view ? ' is-active' : ''}`;
      button.setAttribute('aria-current', tab.id === this.view ? 'page' : 'false');
      button.addEventListener('click', () => {
        if (tab.id === this.view) return;
        this.view = tab.id;
        this.query = '';
        this.notice = '';
        ++this.generation;
        this.busy = false;
        void this.load(false);
      });
      tabsBar.append(button);
    }
    const body = document.createElement('section');
    body.className = 'friends-content';
    if (this.view === 'discover') body.append(this.searchForm());
    if (this.notice) {
      const error = message(this.notice);
      error.className = 'form-error';
      error.setAttribute('role', 'alert');
      body.append(error);
    }
    if (!this.items.length && !this.busy && !this.notice) {
      body.append(message(this.view === 'friends' ? 'No friends yet. Find people to connect with.' :
        this.view === 'requests' ? 'No incoming friend requests.' :
        this.view === 'sent' ? 'No pending sent requests.' : 'No people found. Try a search.'));
    }
    for (const person of this.items) body.append(this.personRow(person));
    if (this.busy) body.append(message('Loading…'));
    if (this.hasMore && !this.busy) {
      const more = node('button', 'Load more');
      more.type = 'button';
      more.className = 'friends-more';
      more.addEventListener('click', () => void this.load(true));
      body.append(more);
    }
    if (this.view === 'discover' && this.query && !this.busy) {
      const hint = message('Search shows the first results from ChatPalez. Refine your search to find someone else.');
      hint.className = 'friends-hint';
      body.append(hint);
    }
    this.content.replaceChildren(heading, tabsBar, body);
  }

  private searchForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'friends-search';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search people by name';
    input.value = this.query;
    input.setAttribute('aria-label', 'Search people');
    const submit = node('button', 'Search');
    submit.type = 'submit';
    form.append(input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (query && query.length < 2) {
        this.notice = 'Enter at least two characters.';
        this.draw();
        return;
      }
      this.query = query;
      this.notice = '';
      ++this.generation;
      this.busy = false;
      void this.load(false);
    });
    return form;
  }

  private personRow(person: FriendPerson): HTMLElement {
    const row = document.createElement('article');
    row.className = 'friends-person';
    const identity = node('button', '');
    identity.type = 'button';
    identity.className = 'friends-person__identity';
    const name = [person.user_firstname, person.user_lastname].filter(Boolean).join(' ') || person.user_name;
    if (person.user_picture) {
      const avatar = document.createElement('img');
      avatar.src = person.user_picture;
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.className = 'friends-person__avatar';
      avatar.addEventListener('error', () => avatar.replaceWith(fallbackAvatar(name)));
      identity.append(avatar);
    } else identity.append(fallbackAvatar(name));
    const details = document.createElement('span');
    details.className = 'friends-person__details';
    const display = node('strong', name);
    if (person.user_verified) display.append(node('span', ' ✓'));
    details.append(display, node('small', `@${person.user_name}`));
    if (person.mutual_friends_count) details.append(node('small', `${person.mutual_friends_count} mutual friends`));
    identity.append(details);
    identity.addEventListener('click', () => {
      if (person.user_name) this.handlers.onOpenProfile(person.user_name);
    });
    row.append(identity);
    const actions = document.createElement('div');
    actions.className = 'friends-person__actions';
    const relation = person.connection || (this.view === 'requests' ? 'request' : this.view === 'sent' ? 'cancel' : 'add');
    const choices: Array<[FriendAction, string]> = relation === 'request'
      ? [['accept', 'Accept'], ['decline', 'Decline']]
      : relation === 'cancel' ? [['cancel', 'Cancel request']]
      : relation === 'remove' ? [['remove', 'Unfriend']]
      : relation === 'add' || relation === 'declined' ? [['add', 'Add friend']] : [];
    for (const [action, label] of choices) {
      const button = node('button', label);
      button.type = 'button';
      button.className = `friends-action friends-action--${action}`;
      button.addEventListener('click', async () => {
        if (action === 'remove' && !window.confirm(`Remove ${name} from your friends?`)) return;
        const generation = this.generation;
        for (const control of actions.querySelectorAll('button')) control.disabled = true;
        try {
          await this.handlers.onConnect(person.user_id, action);
          if (generation === this.generation) await this.load(false);
        } catch (error) {
          if (generation === this.generation) {
            this.notice = errorText(error);
            this.draw();
          }
        }
      });
      actions.append(button);
    }
    row.append(actions);
    return row;
  }
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, value: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}
function message(value: string): HTMLParagraphElement { return node('p', value); }
function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Unable to load friends. Try again.'; }
function fallbackAvatar(name: string): HTMLSpanElement {
  const avatar = node('span', name.split(/\s+/).map(part => part[0] || '').slice(0, 2).join('').toUpperCase());
  avatar.className = 'friends-person__avatar friends-person__avatar--fallback';
  return avatar;
}
