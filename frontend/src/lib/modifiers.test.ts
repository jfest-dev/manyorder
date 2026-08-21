import { describe, it, expect } from 'vitest';
import type { ModifierGroupView, ProductResponse } from './api';
import {
  editorGroupsFromViews, editorGroupsToInputs, validateEditorGroups,
  resolveSelectedOptions, hasRequiredGroup, blankEditorGroup, type EditorGroup,
} from './modifiers';

const views: ModifierGroupView[] = [
  {
    id: 10, name: 'Size', minSelect: 1, maxSelect: 1, required: true, sortOrder: 0,
    options: [
      { id: 100, name: 'Small', priceDelta: 0, sortOrder: 0 },
      { id: 101, name: 'Large', priceDelta: 2, sortOrder: 1 },
    ],
  },
  {
    id: 11, name: 'Add-ons', minSelect: 0, maxSelect: null, required: false, sortOrder: 1,
    options: [
      { id: 200, name: 'Pearls', priceDelta: 1, sortOrder: 0 },
      { id: 201, name: 'Grass Jelly', priceDelta: 1.5, sortOrder: 1 },
    ],
  },
];

describe('editorGroupsFromViews', () => {
  it('maps required choose-one and optional choose-many', () => {
    const g = editorGroupsFromViews(views);
    expect(g[0]).toMatchObject({ name: 'Size', required: true, multiple: false, maxSelect: null });
    expect(g[0].options.map((o) => ({ name: o.name, priceDelta: o.priceDelta })))
      .toEqual([{ name: 'Small', priceDelta: 0 }, { name: 'Large', priceDelta: 2 }]);
    expect(g[1]).toMatchObject({ name: 'Add-ons', required: false, multiple: true, maxSelect: null });
  });
  it('is empty for null/undefined', () => {
    expect(editorGroupsFromViews(null)).toEqual([]);
    expect(editorGroupsFromViews(undefined)).toEqual([]);
  });
});

describe('editorGroupsToInputs', () => {
  it('maps choose-one required to minSelect 1 / maxSelect 1', () => {
    const g: EditorGroup = { name: ' Size ', required: true, multiple: false, maxSelect: null,
      options: [{ name: 'Small', priceDelta: null }, { name: 'Large', priceDelta: 2 }] };
    const [inp] = editorGroupsToInputs([g]);
    expect(inp).toEqual({
      name: 'Size', minSelect: 1, maxSelect: 1, sortOrder: 0,
      options: [{ name: 'Small', priceDelta: 0, sortOrder: 0 }, { name: 'Large', priceDelta: 2, sortOrder: 1 }],
    });
  });
  it('maps optional choose-many to minSelect 0 / maxSelect null', () => {
    const g: EditorGroup = { name: 'Add-ons', required: false, multiple: true, maxSelect: null,
      options: [{ name: 'Pearls', priceDelta: 1 }] };
    expect(editorGroupsToInputs([g])[0]).toMatchObject({ minSelect: 0, maxSelect: null });
  });
  it('drops blank-named option rows', () => {
    const g: EditorGroup = { name: 'X', required: false, multiple: true, maxSelect: null,
      options: [{ name: 'A', priceDelta: 1 }, { name: '  ', priceDelta: null }] };
    expect(editorGroupsToInputs([g])[0].options).toHaveLength(1);
  });
  it('round-trips views → editor → inputs preserving rules', () => {
    const inputs = editorGroupsToInputs(editorGroupsFromViews(views));
    expect(inputs[0]).toMatchObject({ name: 'Size', minSelect: 1, maxSelect: 1 });
    expect(inputs[1]).toMatchObject({ name: 'Add-ons', minSelect: 0, maxSelect: null });
  });
  it('sends group + option server ids back so a save reconciles (keeps ids stable)', () => {
    const inputs = editorGroupsToInputs(editorGroupsFromViews(views));
    expect(inputs[0].id).toBe(10);                       // Size group id round-tripped
    expect(inputs[0].options.map((o) => o.id)).toEqual([100, 101]); // option ids round-tripped
    expect(inputs[1].id).toBe(11);
  });
  it('omits id for a brand-new group/option (no serverId)', () => {
    const g: EditorGroup = { name: 'New', required: false, multiple: false, maxSelect: null,
      options: [{ name: 'A', priceDelta: 1 }] };
    const [inp] = editorGroupsToInputs([g]);
    expect('id' in inp).toBe(false);
    expect('id' in inp.options[0]).toBe(false);
  });
});

describe('validateEditorGroups', () => {
  const ok: EditorGroup = { name: 'Size', required: true, multiple: false, maxSelect: null,
    options: [{ name: 'Small', priceDelta: 0 }] };

  it('passes a valid set', () => {
    expect(validateEditorGroups([ok])).toBeNull();
  });
  it('rejects a nameless group', () => {
    expect(validateEditorGroups([{ ...ok, name: '  ' }])).toMatch(/needs a name/);
  });
  it('rejects a group with no named options', () => {
    expect(validateEditorGroups([{ ...ok, options: [{ name: '', priceDelta: null }] }])).toMatch(/at least one option/);
  });
  it('rejects a negative option price', () => {
    expect(validateEditorGroups([{ ...ok, options: [{ name: 'A', priceDelta: -1 }] }])).toMatch(/negative/);
  });
  it('rejects max exceeding the option count', () => {
    const g: EditorGroup = { name: 'M', required: false, multiple: true, maxSelect: 3,
      options: [{ name: 'A', priceDelta: 0 }, { name: 'B', priceDelta: 0 }] };
    expect(validateEditorGroups([g])).toMatch(/can't exceed/);
  });
});

function product(): ProductResponse {
  return {
    id: 1, merchantId: 1, name: 'Milk Tea', description: null, price: 10, isActive: true,
    categoryId: null, categoryName: null, stock: 9, sku: null, photoUrl: null, preOrder: false,
    preOrderReadyDate: null, preOrderReadyTimeStart: null, preOrderReadyTimeEnd: null, preOrderNote: null,
    modifierGroups: views, unitsSold: 0, createdAt: '2026-01-01T00:00:00',
  };
}

describe('resolveSelectedOptions', () => {
  it('returns picked options in group/option order + summed delta', () => {
    const { selectedOptions, modifiersTotal } = resolveSelectedOptions(product(), [201, 101]);
    expect(selectedOptions.map((o) => o.optionName)).toEqual(['Large', 'Grass Jelly']);
    expect(modifiersTotal).toBe(3.5);
  });
  it('ignores unknown ids', () => {
    expect(resolveSelectedOptions(product(), [999]).modifiersTotal).toBe(0);
  });
});

describe('hasRequiredGroup', () => {
  it('is true when any group is required', () => {
    expect(hasRequiredGroup(product())).toBe(true);
  });
  it('is false with no required group', () => {
    expect(hasRequiredGroup({ modifierGroups: [] })).toBe(false);
  });
});

describe('blankEditorGroup', () => {
  it('starts optional choose-one with two empty option rows', () => {
    const g = blankEditorGroup();
    expect(g).toMatchObject({ required: false, multiple: false, maxSelect: null });
    expect(g.options).toHaveLength(2);
  });
});
