'use client';

import { describe, expect, it } from 'vitest';

import { createPropertyListStore } from './property-list.store';

describe('property-list store', () => {
  it('initializes with query "" and currentPage 1', () => {
    const store = createPropertyListStore();
    const { query, currentPage } = store.getState();
    expect(query).toBe('');
    expect(currentPage).toBe(1);
  });

  it('setQuery atomically sets query and resets currentPage to 1', () => {
    const store = createPropertyListStore();
    store.getState().setPage(5);
    expect(store.getState().currentPage).toBe(5);
    store.getState().setQuery('casa');
    const { query, currentPage } = store.getState();
    expect(query).toBe('casa');
    expect(currentPage).toBe(1);
  });

  it('setQuery resets to 1 even when same value is passed', () => {
    const store = createPropertyListStore();
    store.getState().setQuery('casa');
    store.getState().setPage(3);
    expect(store.getState().currentPage).toBe(3);
    store.getState().setQuery('casa');
    expect(store.getState().query).toBe('casa');
    expect(store.getState().currentPage).toBe(1);
  });

  it('setQuery with empty string clears query and resets page', () => {
    const store = createPropertyListStore();
    store.getState().setQuery('casa');
    store.getState().setPage(2);
    store.getState().setQuery('');
    expect(store.getState().query).toBe('');
    expect(store.getState().currentPage).toBe(1);
  });

  it('setPage updates currentPage without touching query', () => {
    const store = createPropertyListStore();
    store.getState().setQuery('casa');
    expect(store.getState().query).toBe('casa');
    store.getState().setPage(3);
    expect(store.getState().currentPage).toBe(3);
    expect(store.getState().query).toBe('casa');
  });

  it('reset restores defaults from mutated state', () => {
    const store = createPropertyListStore();
    store.getState().setQuery('casa');
    store.getState().setPage(4);
    store.getState().reset();
    expect(store.getState().query).toBe('');
    expect(store.getState().currentPage).toBe(1);
  });

  it('factory isolation — one instance does not pollute another', () => {
    const a = createPropertyListStore();
    const b = createPropertyListStore();
    a.getState().setQuery('foo');
    expect(a.getState().query).toBe('foo');
    expect(b.getState().query).toBe('');
    b.getState().setPage(7);
    expect(a.getState().currentPage).toBe(1);
    expect(b.getState().currentPage).toBe(7);
  });

  it('action references are stable across state changes', () => {
    const store = createPropertyListStore();
    const beforeQuery = store.getState().setQuery;
    const beforePage = store.getState().setPage;
    const beforeReset = store.getState().reset;
    store.getState().setQuery('casa');
    store.getState().setPage(2);
    expect(store.getState().setQuery).toBe(beforeQuery);
    expect(store.getState().setPage).toBe(beforePage);
    expect(store.getState().reset).toBe(beforeReset);
  });

  it('selectors are granular — s=>s.query does not recreate on page change (store level)', () => {
    const store = createPropertyListStore();
    let queryCalls = 0;
    let pageCalls = 0;
    const unsubQuery = store.subscribe((next, prev) => {
      if (next.query !== prev.query) queryCalls += 1;
    });
    const unsubPage = store.subscribe((next, prev) => {
      if (next.currentPage !== prev.currentPage) pageCalls += 1;
    });
    store.getState().setPage(2);
    expect(pageCalls).toBe(1);
    expect(queryCalls).toBe(0);
    store.getState().setQuery('casa');
    expect(queryCalls).toBe(1);
    // setQuery also resets page, so page observer fires again
    expect(pageCalls).toBe(2);
    unsubQuery();
    unsubPage();
  });
});
