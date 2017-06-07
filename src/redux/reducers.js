import { combineReducers } from 'redux'
import {demoReducer} from '../modules/demo'
/**
 * This place is to register all reducers of the app.
 */

export default combineReducers({
    demo: demoReducer
})