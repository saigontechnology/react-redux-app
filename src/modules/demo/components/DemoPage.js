import React from 'react'
import {connect} from 'react-redux'
import * as demoActions from '../actions'

class DemoPage extends React.Component{
	render(){
		const {
			count, 
			decrease, 
			increase
		} = this.props

		return <div>
			<h4>Count: {count}</h4>
			<button onClick={increase}>Increase</button>
			<button onClick={decrease}>Decrease</button>
		</div>
	}
}

export default connect(state => ({
	count: state.demo.count
}), dispatch => ({
	decrease: () => dispatch(demoActions.decrease()),
	increase: () => dispatch(demoActions.increase())
}))(DemoPage)