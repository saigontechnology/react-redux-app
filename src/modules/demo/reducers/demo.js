import {INCREASE, DECREASE} from '../actions'

const initialState = {
	count: -33
}

export default function demo(state = initialState, action){
	switch(action.type){
		case INCREASE:
			return {
				...state,
				count: state.count + 1
			}
		case DECREASE:
			return {
				...state,
				count: state.count - 1
			}
		default: 
			return state
	}
}