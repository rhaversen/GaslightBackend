import { MeyerStrategyAPI } from '../meyer/types.ts'

const main = (api: MeyerStrategyAPI) => {
	// Rolling twice is cheating
	api.roll()
	api.roll()
}

export default main
