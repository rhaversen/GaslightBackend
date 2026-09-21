import 'mongoose'

declare module 'mongoose' {
	interface Document {
		/** The virtual string form of _id provided by mongoose documents */
		id: string
	}
}
