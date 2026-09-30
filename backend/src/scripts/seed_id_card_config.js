import pool, { query } from '../config/db.js';

async function seedIdCardConfig() {
  try {
    const existing = await query('SELECT * FROM system_settings WHERE setting_key = ?', ['id_card_config']);
    if (!existing || existing.length === 0) {
      await query(
        `INSERT INTO system_settings (setting_key, setting_value, value_type, category, is_public, description)
         VALUES (?, ?, 'json', 'general', 1, 'Official digital ID card custom designs and templates for all roles')`,
        ['id_card_config', JSON.stringify({})]
      );
      console.log('Seeded id_card_config setting successfully.');
    } else {
      console.log('id_card_config already present in system_settings.');
    }
  } catch (err) {
    console.error('Error seeding id_card_config:', err);
  } finally {
    await pool.end();
  }
}

seedIdCardConfig();
