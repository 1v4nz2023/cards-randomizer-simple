import { dbRun, dbGet, dbAll } from '../db.js'

export async function getInventoryByUser(userId) {
  return await dbAll(
    'SELECT * FROM inventory_cards WHERE user_id = ? ORDER BY binder_page ASC, binder_slot ASC, updated_at DESC',
    [userId]
  )
}

export async function getInventoryItemById(id, userId) {
  return await dbGet(
    'SELECT * FROM inventory_cards WHERE id = ? AND user_id = ?',
    [id, userId]
  )
}

export async function addInventoryCard(userId, data) {
  const updatedAt = new Date().toISOString()
  const result = await dbRun(
    `INSERT INTO inventory_cards (
      user_id, card_id, card_code, quantity, condition, set_name, rarity, binder_page, binder_slot, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.card_id,
      data.card_code || null,
      data.quantity || 1,
      data.condition || 'Near Mint',
      data.set_name || null,
      data.rarity || null,
      data.binder_page ? parseInt(data.binder_page, 10) : null,
      data.binder_slot ? parseInt(data.binder_slot, 10) : null,
      data.notes || null,
      updatedAt,
    ]
  )
  return await getInventoryItemById(result.lastID, userId)
}

export async function updateInventoryCard(id, userId, data) {
  const updatedAt = new Date().toISOString()
  await dbRun(
    `UPDATE inventory_cards SET
      card_code = COALESCE(?, card_code),
      quantity = COALESCE(?, quantity),
      condition = COALESCE(?, condition),
      set_name = COALESCE(?, set_name),
      rarity = COALESCE(?, rarity),
      binder_page = COALESCE(?, binder_page),
      binder_slot = COALESCE(?, binder_slot),
      notes = COALESCE(?, notes),
      updated_at = ?
    WHERE id = ? AND user_id = ?`,
    [
      data.card_code !== undefined ? data.card_code : null,
      data.quantity !== undefined ? data.quantity : null,
      data.condition !== undefined ? data.condition : null,
      data.set_name !== undefined ? data.set_name : null,
      data.rarity !== undefined ? data.rarity : null,
      data.binder_page !== undefined ? (data.binder_page ? parseInt(data.binder_page, 10) : null) : null,
      data.binder_slot !== undefined ? (data.binder_slot ? parseInt(data.binder_slot, 10) : null) : null,
      data.notes !== undefined ? data.notes : null,
      updatedAt,
      id,
      userId,
    ]
  )
  return await getInventoryItemById(id, userId)
}

export async function deleteInventoryCard(id, userId) {
  const result = await dbRun(
    'DELETE FROM inventory_cards WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return result.changes > 0
}
