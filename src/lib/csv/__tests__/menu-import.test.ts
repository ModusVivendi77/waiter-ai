import { describe, expect, it } from 'vitest'

import { parseCsvLine, parseCsvRows } from '@/lib/csv/menu-import'

describe('parseCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCsvLine('Food,Burger,Beef burger,12.00')).toEqual(['Food', 'Burger', 'Beef burger', '12.00'])
  })

  it('supports quoted fields containing commas', () => {
    expect(parseCsvLine('Drinks,"Tonic, Zero","Sugar-free mixer, bottled",4.50')).toEqual([
      'Drinks',
      'Tonic, Zero',
      'Sugar-free mixer, bottled',
      '4.50',
    ])
  })

  it('supports escaped quotes inside quoted fields', () => {
    expect(parseCsvLine('Food,"Burger ""Deluxe""",Tasty,12.00')).toEqual(['Food', 'Burger "Deluxe"', 'Tasty', '12.00'])
  })

  it('trims whitespace from each field', () => {
    expect(parseCsvLine('  Food ,  Burger  ,  Beef burger ,12.00')).toEqual(['Food', 'Burger', 'Beef burger', '12.00'])
  })

  it('trims quoted fields as well (preserving production behavior)', () => {
    expect(parseCsvLine('Food,"  Burger  ",Desc,5.00')).toEqual(['Food', 'Burger', 'Desc', '5.00'])
  })
})

describe('parseCsvRows', () => {
  it('parses multiple valid rows', () => {
    const result = parseCsvRows('Food,Burger,Beef burger with fries,12.00\nDrinks,Mythos,Greek lager,4.00')

    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { category: 'Food', name: 'Burger', description: 'Beef burger with fries', price: 12, nameEl: null, descriptionEl: null },
      { category: 'Drinks', name: 'Mythos', description: 'Greek lager', price: 4, nameEl: null, descriptionEl: null },
    ])
  })

  it('joins extra comma-separated fields into the description', () => {
    const result = parseCsvRows('Food,Burger,Beef,medium,12.00')
    expect(result.rows[0]?.description).toBe('Beef,medium')
    expect(result.rows[0]?.price).toBe(12)
  })

  it('ignores blank lines', () => {
    const result = parseCsvRows('Food,Burger,Beef burger,12.00\n\n\nDrinks,Mythos,Greek lager,4.00')
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toEqual([])
  })

  it('reports lines with fewer than 4 fields', () => {
    const result = parseCsvRows('Food,Burger,12.00')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toEqual(['Line 1: expected at least 4 comma-separated values.'])
  })

  it('reports missing category or name', () => {
    const result = parseCsvRows(',Burger,Beef burger,12.00\nFood,,Beef burger,12.00')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toEqual([
      'Line 1: category and name are required.',
      'Line 2: category and name are required.',
    ])
  })

  it('reports invalid prices', () => {
    const result = parseCsvRows('Food,Burger,Beef burger,abc\nFood,Burger 2,Beef burger,-5')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toEqual([
      'Line 1: invalid price "abc".',
      'Line 2: invalid price "-5".',
    ])
  })

  it('reports duplicate items within the same category', () => {
    const result = parseCsvRows('Food,Burger,Beef burger,12.00\nFood,Burger,Another one,13.00')
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual(['Line 2: duplicate item "Burger" in category "Food".'])
  })

  it('treats duplicate checks as case-insensitive', () => {
    const result = parseCsvRows('Food,Burger,Beef burger,12.00\nfood,burger,Another one,13.00')
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual(['Line 2: duplicate item "burger" in category "food".'])
  })

  it('accepts the same item name in different categories', () => {
    const result = parseCsvRows('Food,Burger,Beef burger,12.00\nSpecials,Burger,Same name,13.00')
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toEqual([])
  })

  it('handles zero prices', () => {
    const result = parseCsvRows('Drinks,Water,Still water,0.00')
    expect(result.rows[0]?.price).toBe(0)
    expect(result.errors).toEqual([])
  })
})

describe('parseCsvRows — header row with Greek columns', () => {
  it('parses name_el and description_el columns', () => {
    const result = parseCsvRows(
      'category,name,description,price,name_el,description_el\n' +
        'Starters,Burger,Beef burger with fries,12.00,Μπέργκερ,Μπέργκερ με πατάτες\n' +
        'Drinks,Mythos,Greek lager,4.00,Μύθος,Ελληνική λάγερ μπύρα'
    )
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      {
        category: 'Starters',
        name: 'Burger',
        description: 'Beef burger with fries',
        price: 12,
        nameEl: 'Μπέργκερ',
        descriptionEl: 'Μπέργκερ με πατάτες',
      },
      {
        category: 'Drinks',
        name: 'Mythos',
        description: 'Greek lager',
        price: 4,
        nameEl: 'Μύθος',
        descriptionEl: 'Ελληνική λάγερ μπύρα',
      },
    ])
  })

  it('keeps Greek columns null when the header omits them', () => {
    const result = parseCsvRows('category,name,description,price\nStarters,Burger,Beef burger,12.00')
    expect(result.errors).toEqual([])
    expect(result.rows[0]?.nameEl).toBeNull()
    expect(result.rows[0]?.descriptionEl).toBeNull()
  })

  it('supports header columns in any order and quoted greek text', () => {
    const result = parseCsvRows(
      'price,name_el,name,category,description\n' +
        '8.00,"Τζατζίκι & Πίτα",Tzatziki & Pita,Starters,"Yogurt, cucumber dip"'
    )
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      category: 'Starters',
      name: 'Tzatziki & Pita',
      description: 'Yogurt, cucumber dip',
      price: 8,
      nameEl: 'Τζατζίκι & Πίτα',
    })
  })

  it('reports header-mode rows missing category or price', () => {
    const result = parseCsvRows(
      'category,name,price\nStarters,Burger,12.00\n,NoCategory,5.00\nStarters,NoPrice,'
    )
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([
      'Line 3: category and name are required.',
      'Line 4: invalid price "".',
    ])
  })
})