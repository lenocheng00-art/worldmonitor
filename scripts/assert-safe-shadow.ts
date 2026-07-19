import { assertShadowEnvironment } from "@/lib/shadow/safety";

const environment = assertShadowEnvironment();
console.log(JSON.stringify({
  safe: true,
  mode: "production-read-only-to-isolated-shadow",
  productionProjectRef: environment.productionProjectRef,
  shadowProjectRef: environment.shadowProjectRef,
  shadowSchema: environment.shadowSchema,
}));
