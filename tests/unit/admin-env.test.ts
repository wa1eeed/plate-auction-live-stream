import { describe, expect, it } from 'vitest'

describe('حساب الإدارة من متغيّرات البيئة', () => {
  it('يُطابَق مهما كتبه الناشر بحرفٍ كبير أو بمسافات', async () => {
    process.env.DEMO_ADMIN_EMAIL = '  Admin@MySite.COM '
    process.env.DEMO_ADMIN_PASSWORD = 'User#2011'
    const { createSeededMemoryStore } = await import('@/lib/store')
    const { verifyPassword } = await import('@/lib/server/crypto')

    const store = createSeededMemoryStore()
    const found = await store.findAdminByEmail('Admin@MySite.com')

    expect(found, 'لم يُوجد الحساب — تطبيع الحرف مكسور').not.toBeNull()
    expect(verifyPassword('User#2011', found!.passwordHash)).toBe(true)
    expect(verifyPassword('admin1234', found!.passwordHash)).toBe(false)
  })
})
