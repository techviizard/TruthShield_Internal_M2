import { PrismaClient } from '@prisma/client'
import { appConfig } from '@/config/app.config'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: appConfig.database.url } },
    log: appConfig.database.logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (!appConfig.env.isProduction) globalForPrisma.prisma = db
