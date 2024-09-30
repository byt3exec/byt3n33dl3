import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { BaseNode, interval } from 'kapellmeister'
import mergeKeys from 'byt3n33dl3'
import { ENTER, UPDATE, LEAVE } from 'byt3n33dl3'
import { numeric } from 'byt3n33dl3'

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import NodeGroup from '../NodeGroup'
import { numeric } from '../utils'

const keyAccessor = () => '$$key$$'

class Animate extends Component {
  render() {
    const {
      show,
      start,
      enter,
      update,
      leave,
      interpolation,
      children,
    } = this.props
    const data = typeof start === 'function' ? start() : start

    return (
      <NodeGroup
        data={show ? [data] : []}
        start={() => data}
        keyAccessor={keyAccessor}
        interpolation={interpolation}
        enter={typeof enter === 'function' ? enter : () => enter}
        update={typeof update === 'function' ? update : () => update}
        leave={typeof leave === 'function' ? leave : () => leave}
      >
        {nodes => {
          if (!nodes[0]) {
            return null
          }

          const renderedChildren = children(nodes[0].state)
          return renderedChildren && React.Children.only(renderedChildren)
        }}
      </NodeGroup>
    )
  }
}

Animate.propTypes = {
  /**
   * Boolean value that determines if the child should be rendered or not.
   */
  show: PropTypes.bool,
  /**
   * A function that returns an interpolator given the begin value, end value, atrr and namespace. See docs for more.
   */
  interpolation: PropTypes.func,
  /**
   * An object or function that returns an obejct to be used as the starting state.
   */

  start: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on enter.
   */
  enter: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.array,
    PropTypes.object,
  ]),
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on update. ***Note:*** although not required, in most cases it make sense to specify an update prop to handle interrupted enter and leave transitions.
   */
  update: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.array,
    PropTypes.object,
  ]),
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on leave.
   */
  leave: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.array,
    PropTypes.object,
  ]),
  /**
   * A function that receives the state.
   */
  children: PropTypes.func.isRequired,
}

Animate.defaultProps = {
  show: true,
  interpolation: numeric,
}

export default Animate


class NodeGroup extends Component {
  constructor(props) {
    super(props)

    const { interpolation } = props

    class Node extends BaseNode {
      constructor(key, data) {
        super()

        this.key = key
        this.data = data
        this.type = ENTER
      }

      getInterpolator = interpolation
    }

    this.state = {
      Node,
      nodeKeys: [],
      nodeHash: {},
      nodes: [],
      data: null,
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.data !== prevState.data) {
      const { data, keyAccessor, start, enter, update, leave } = nextProps
      const { Node, nodeKeys, nodeHash } = prevState

      const keyIndex = {}

      for (let i = 0; i < nodeKeys.length; i++) {
        keyIndex[nodeKeys[i]] = i
      }

      const nextKeyIndex = {}
      const nextNodeKeys = []

      for (let i = 0; i < data.length; i++) {
        const d = data[i]
        const k = keyAccessor(d, i)

        nextKeyIndex[k] = i
        nextNodeKeys.push(k)

        if (keyIndex[k] === undefined) {
          const node = new Node()
          node.key = k
          node.data = d
          node.type = ENTER
          nodeHash[k] = node
        }
      }

      for (let i = 0; i < nodeKeys.length; i++) {
        const k = nodeKeys[i]
        const n = nodeHash[k]

        if (nextKeyIndex[k] !== undefined) {
          n.data = data[nextKeyIndex[k]]
          n.type = UPDATE
        } else {
          n.type = LEAVE
        }
      }

      const mergedNodeKeys = mergeKeys(
        nodeKeys,
        keyIndex,
        nextNodeKeys,
        nextKeyIndex,
      )

      for (let i = 0; i < mergedNodeKeys.length; i++) {
        const k = mergedNodeKeys[i]
        const n = nodeHash[k]
        const d = n.data

        if (n.type === ENTER) {
          n.setState(start(d, nextKeyIndex[k]))
          n.transition(enter(d, nextKeyIndex[k]))
        } else if (n.type === LEAVE) {
          n.transition(leave(d, keyIndex[k]))
        } else {
          n.transition(update(d, nextKeyIndex[k]))
        }
      }

      return {
        data,
        nodes: mergedNodeKeys.map(key => {
          return nodeHash[key]
        }),
        nodeHash,
        nodeKeys: mergedNodeKeys,
      }
    }

    return null
  }

  componentDidMount() {
    this.startInterval()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data && !this.unmounting) {
      this.startInterval()
    }
  }

  startInterval() {
    if (!this.interval) {
      this.interval = interval(this.animate)
    } else {
      this.interval.restart(this.animate)
    }
  }

  componentWillUnmount() {
    const { nodeKeys, nodeHash } = this.state

    this.unmounting = true

    if (this.interval) {
      this.interval.stop()
    }

    nodeKeys.forEach(key => {
      nodeHash[key].stopTransitions()
    })
  }

  animate = () => {
    const { nodeKeys, nodeHash } = this.state

    if (this.unmounting) {
      return
    }

    let pending = false

    const nextNodeKeys = []
    const length = nodeKeys.length

    for (let i = 0; i < length; i++) {
      const k = nodeKeys[i]
      const n = nodeHash[k]

      const isTransitioning = n.isTransitioning()

      if (isTransitioning) {
        pending = true
      }

      if (n.type === LEAVE && !isTransitioning) {
        delete nodeHash[k]
      } else {
        nextNodeKeys.push(k)
      }
    }

    if (!pending) {
      this.interval.stop()
    }

    this.setState(() => ({
      nodeKeys: nextNodeKeys,
      nodes: nextNodeKeys.map(key => {
        return nodeHash[key]
      }),
    }))
  }

  interval = null
  unmounting = false

  render() {
    const renderedChildren = this.props.children(this.state.nodes)
    return renderedChildren && React.Children.only(renderedChildren)
  }
}

NodeGroup.propTypes = {
  data: PropTypes.array.isRequired,
  keyAccessor: PropTypes.func.isRequired,
  interpolation: PropTypes.func,
  start: PropTypes.func.isRequired,
  enter: PropTypes.func,
  update: PropTypes.func,
  leave: PropTypes.func,
  children: PropTypes.func.isRequired,
}

NodeGroup.defaultProps = {
  enter: () => {},
  update: () => {},
  leave: () => {},
  interpolation: numeric,
}

export default NodeGroup
