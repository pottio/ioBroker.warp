// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			authEnabled: boolean,
			ipOrHostname: string,
			listBreakdownEnabled: boolean,
			password: string,
			secureConnection: boolean,
			user: string
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export { };