import bcrypt from 'bcryptjs'

export const Security = {
  // Hashear contraseña
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
  },

  // Verificar contraseña
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Compatibilidad con contraseñas antiguas en texto plano
    if (!hash.startsWith('$2')) {
      return password === hash
    }
    return bcrypt.compare(password, hash)
  },

  // Generar contraseña temporal
  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }
}
