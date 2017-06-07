import React from 'react'
import {Layout} from './modules/common'
import {DemoPage} from './modules/demo'

export default class App extends React.Component {
    render() {
        return <Layout>
 			<DemoPage/>
        </Layout>
    }
}