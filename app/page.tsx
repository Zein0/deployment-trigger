import DeployPage from "../deployment-trigger"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Deployment Platform",
  description: "Deploy your applications to the cloud with ease.",
}

export default function SyntheticV0PageForDeployment() {
  return <DeployPage />
}