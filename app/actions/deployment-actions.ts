"use server"

import { Redis } from "@upstash/redis"

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

// Cooldown duration in milliseconds (5 minutes)
const COOLDOWN_MS = 5 * 60 * 1000

export async function getDeploymentStatus() {
  // Get all keys with the 'deployment:' prefix
  const keys = await redis.keys("deployment:*")
  const result: Record<string, number> = {}

  if (keys.length > 0) {
    const values = await redis.mget(...keys)
    keys.forEach((key, index) => {
      const portalEnv = key.replace("deployment:", "")
      result[portalEnv] = Number(values[index])
    })
  }

  return result
}

export async function recordDeployment(portal: string, env: string) {
  const key = `deployment:${portal}-${env}`
  const now = Date.now()

  // Set the deployment timestamp with an expiration (5 minutes)
  await redis.set(key, now.toString(), { ex: COOLDOWN_MS / 1000 })

  return { success: true }
}

export async function canDeploy(portal: string, env: string) {
  const key = `deployment:${portal}-${env}`
  const lastDeployment = await redis.get(key)

  if (!lastDeployment) {
    return { canDeploy: true, remainingTime: 0 }
  }

  const now = Date.now()
  const elapsedMs = now - Number(lastDeployment)

  if (elapsedMs < COOLDOWN_MS) {
    const remainingMs = COOLDOWN_MS - elapsedMs
    return {
      canDeploy: false,
      remainingTime: Math.ceil(remainingMs / 1000), // remaining time in seconds
    }
  }

  return { canDeploy: true, remainingTime: 0 }
}

