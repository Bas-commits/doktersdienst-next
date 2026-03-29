import * as pulumi from "@pulumi/pulumi";
import * as scaleway from "@ediri/scaleway";
import "dotenv/config";

const config = new pulumi.Config();
const databaseUrl = config.requireSecret("databaseUrl");
const betterAuthSecret = config.requireSecret("betterAuthSecret");

// Container Namespace (groups your serverless containers)
const namespace = new scaleway.ContainerNamespace("doktersdienst", {
  description: "Doktersdienst Next.js application",
  region: process.env.SCW_DEFAULT_REGION,
});

// Container Registry (stores your Docker images)
const registry = new scaleway.RegistryNamespace("doktersdienst", {
  description: "Doktersdienst container images",
  isPublic: false,
  region: process.env.SCW_DEFAULT_REGION,
});

// Serverless Container
const container = new scaleway.Container("doktersdienst", {
  namespaceId: namespace.id,
  registryImage: pulumi.interpolate`${registry.endpoint}/doktersdienst-next:latest`,
  port: 3005,
  cpuLimit: 250,
  memoryLimit: 512,
  minScale: 0,
  maxScale: 5,
  maxConcurrency: 5,
  timeout: 300,
  privacy: "public",
  protocol: "http1",
  httpOption: "redirected",
  deploy: true,
  environmentVariables: {
    BETTER_AUTH_URL: "https://doktersdienst93b86644e5e3eab-doktersdienst-0a2e9ea.functions.fnc.nl-ams.scw.cloud",
  },
  secretEnvironmentVariables: {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: betterAuthSecret,
  },
});

// Exports
export const containerUrl = container.domainName;
export const registryEndpoint = registry.endpoint;
