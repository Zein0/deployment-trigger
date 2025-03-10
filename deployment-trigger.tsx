"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { canDeploy, recordDeployment } from "@/app/actions/deployment-actions"

const ENV_CONFIG = {
  cms: {
    dev: process.env.NEXT_PUBLIC_PORTAL_A_DEV, // Reusing existing env vars
    test: process.env.NEXT_PUBLIC_PORTAL_A_TEST,
    prod: process.env.NEXT_PUBLIC_PORTAL_A_PROD,
  },
  shop: {
    dev: process.env.NEXT_PUBLIC_PORTAL_B_DEV, // Reusing existing env vars
    test: process.env.NEXT_PUBLIC_PORTAL_B_TEST,
    prod: process.env.NEXT_PUBLIC_PORTAL_B_PROD,
  },
  clinic: {
    dev: process.env.NEXT_PUBLIC_PORTAL_C_DEV, // Reusing existing env vars - update these when you have new env vars
    test: process.env.NEXT_PUBLIC_PORTAL_C_TEST,
    prod: process.env.NEXT_PUBLIC_PORTAL_C_PROD,
  },
  doctor: {
    dev: process.env.NEXT_PUBLIC_PORTAL_D_DEV, // Reusing existing env vars - update these when you have new env vars
    test: process.env.NEXT_PUBLIC_PORTAL_D_TEST,
    prod: process.env.NEXT_PUBLIC_PORTAL_D_PROD,
  },
}

const PORTAL_NAMES = {
  cms: "CMS",
  shop: "Shop",
  clinic: "Clinic",
  doctor: "Doctor",
}

const ENV_NAMES = {
  dev: "Development",
  test: "Testing",
  prod: "Production",
}

export default function DeployPage() {
  const [portal, setPortal] = useState("cms")
  const [env, setEnv] = useState("dev")
  const [isLoading, setIsLoading] = useState(false)
  const [cooldown, setCooldown] = useState({ inCooldown: false, remainingTime: 0 })
  const [lastDeployment, setLastDeployment] = useState<{
    portal: string
    env: string
    timestamp: string
    success: boolean
  } | null>(null)

  // Add these new state variables after the existing useState declarations
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Add this function before the triggerDeployment function
  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password === process.env.DEPLOYMENT_PASSWORD) {
      setIsAuthenticated(true)
      toast.success("Authentication successful")
    } else {
      toast.error("Invalid password")
    }
  }

  const triggerDeployment = async () => {
    // Check if deployment is allowed
    const deployStatus = await canDeploy(portal, env)
    if (!deployStatus.canDeploy) {
      const minutes = Math.floor(deployStatus.remainingTime / 60)
      const seconds = deployStatus.remainingTime % 60
      toast.error(`Deployment in cooldown. Please wait ${minutes}m ${seconds}s before deploying again.`)
      return
    }

    // Confirm before production deployments
    if (env === "prod") {
      const confirmed = window.confirm(
        `Are you sure you want to trigger a PRODUCTION deployment for ${PORTAL_NAMES[portal as keyof typeof PORTAL_NAMES]}?`,
      )
      if (!confirmed) return
    }

    const url = ENV_CONFIG[portal as keyof typeof ENV_CONFIG][env as keyof (typeof ENV_CONFIG)[keyof typeof ENV_CONFIG]]

    if (!url) {
      toast.error("Deployment URL is missing for selected portal and environment")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        // Record the deployment on the server
        await recordDeployment(portal, env)

        // Update local state
        setCooldown({ inCooldown: true, remainingTime: 5 * 60 }) // 5 minutes

        toast.success(
          `Deployment triggered successfully for ${PORTAL_NAMES[portal as keyof typeof PORTAL_NAMES]} (${ENV_NAMES[env as keyof typeof ENV_NAMES]})`,
        )
        setLastDeployment({
          portal,
          env,
          timestamp: new Date().toLocaleString(),
          success: true,
        })
      } else {
        const errorData = await response.json().catch(() => null)
        toast.error(`Failed to trigger deployment: ${errorData?.message || response.statusText || "Unknown error"}`)
        setLastDeployment({
          portal,
          env,
          timestamp: new Date().toLocaleString(),
          success: false,
        })
      }
    } catch (error) {
      toast.error(`Error triggering deployment: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLastDeployment({
        portal,
        env,
        timestamp: new Date().toLocaleString(),
        success: false,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check cooldown status when portal or env changes, or periodically
  useEffect(() => {
    const checkCooldownStatus = async () => {
      const status = await canDeploy(portal, env)
      setCooldown({
        inCooldown: !status.canDeploy,
        remainingTime: status.remainingTime,
      })
    }

    // Check immediately when portal or env changes
    checkCooldownStatus()

    // Set up interval to check every second if in cooldown
    const interval = setInterval(() => {
      if (cooldown.inCooldown) {
        checkCooldownStatus()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [portal, env, cooldown.inCooldown])

  // Format remaining time for display
  const formatRemainingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Calculate progress percentage for cooldown
  const cooldownProgress = cooldown.inCooldown ? 100 - (cooldown.remainingTime / (5 * 60)) * 100 : 100

  // Replace the entire return statement with this code
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/40">
      {!isAuthenticated ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Deployment Authentication</CardTitle>
            <CardDescription>Enter your password to access the deployment trigger</CardDescription>
          </CardHeader>
          <form onSubmit={verifyPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  autoComplete="current-password"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Basma Deployment Trigger</CardTitle>
            <CardDescription>Select a portal and environment to trigger a deployment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="portal" className="text-sm font-medium">
                Portal
              </label>
              <Select value={portal} onValueChange={setPortal}>
                <SelectTrigger id="portal">
                  <SelectValue placeholder="Select portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cms">CMS</SelectItem>
                  <SelectItem value="shop">Shop</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="environment" className="text-sm font-medium">
                Environment
              </label>
              <Select value={env} onValueChange={setEnv}>
                <SelectTrigger id="environment">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="test">Testing</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {env === "prod" && (
              <Alert variant="destructive">
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  You are about to trigger a production deployment. This will affect live users.
                </AlertDescription>
              </Alert>
            )}

            {cooldown.inCooldown && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Deployment Cooldown</AlertTitle>
                <AlertDescription>
                  This environment was recently deployed. Please wait {formatRemainingTime(cooldown.remainingTime)}{" "}
                  before deploying again.
                  <Progress value={cooldownProgress} className="mt-2" />
                </AlertDescription>
              </Alert>
            )}

            {lastDeployment && (
              <div className="text-sm border rounded-md p-3 bg-muted/50">
                <p className="font-medium">Last deployment attempt:</p>
                <p>
                  {PORTAL_NAMES[lastDeployment.portal as keyof typeof PORTAL_NAMES]} (
                  {ENV_NAMES[lastDeployment.env as keyof typeof ENV_NAMES]})
                </p>
                <p>{lastDeployment.timestamp}</p>
                <p className={lastDeployment.success ? "text-green-600" : "text-red-600"}>
                  {lastDeployment.success ? "Successful" : "Failed"}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button
              onClick={triggerDeployment}
              disabled={isLoading || cooldown.inCooldown}
              className="w-full"
              variant={env === "prod" ? "destructive" : "default"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Triggering...
                </>
              ) : cooldown.inCooldown ? (
                <>Cooldown: {formatRemainingTime(cooldown.remainingTime)}</>
              ) : (
                <>{env === "prod" ? "Trigger Production Deployment" : "Trigger Deployment"}</>
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setIsAuthenticated(false)}>
              Logout
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

