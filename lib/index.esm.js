import React, { Component, createRef, Children, cloneElement } from 'react';
import isEqual from 'lodash.isequal';
import { DragSource, DropTarget, DndContext, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { VList } from 'virtua';
import styleInject from 'C:/Users/Khalil Technozor/Desktop/Zied/react-sortable-tree/node_modules/style-inject/dist/style-inject.es.js';

const defaultGetNodeKey = ({ treeIndex }) => treeIndex;
// Cheap hack to get the text of a react object
const getReactElementText = (parent) => {
    if (typeof parent === 'string') {
        return parent;
    }
    if (parent === undefined ||
        typeof parent !== 'object' ||
        !parent.props ||
        !parent.props.children ||
        (typeof parent.props.children !== 'string' &&
            typeof parent.props.children !== 'object')) {
        return '';
    }
    if (typeof parent.props.children === 'string') {
        return parent.props.children;
    }
    return parent.props.children
        .map((child) => getReactElementText(child))
        .join('');
};
// Search for a query string inside a node property
const stringSearch = (key, searchQuery, node, path, treeIndex) => {
    if (typeof node[key] === 'function') {
        // Search within text after calling its function to generate the text
        return String(node[key]({ node, path, treeIndex })).includes(searchQuery);
    }
    if (typeof node[key] === 'object') {
        // Search within text inside react elements
        return getReactElementText(node[key]).includes(searchQuery);
    }
    // Search within string
    return node[key] && String(node[key]).includes(searchQuery);
};
const defaultSearchMethod = ({ node, path, treeIndex, searchQuery, }) => {
    return (stringSearch('title', searchQuery, node, path, treeIndex) ||
        stringSearch('subtitle', searchQuery, node, path, treeIndex));
};

// @ts-nocheck
/**
 * Performs a depth-first traversal over all of the node descendants,
 * incrementing currentIndex by 1 for each
 */
const getNodeDataAtTreeIndexOrNextIndex = ({ targetIndex, node, currentIndex, getNodeKey, path = [], lowerSiblingCounts = [], ignoreCollapsed = true, isPseudoRoot = false, }) => {
    // The pseudo-root is not considered in the path
    const selfPath = isPseudoRoot
        ? []
        : [...path, getNodeKey({ node, treeIndex: currentIndex })];
    // Return target node when found
    if (currentIndex === targetIndex) {
        return {
            node,
            lowerSiblingCounts,
            path: selfPath,
        };
    }
    // Add one and continue for nodes with no children or hidden children
    if (!node?.children || (ignoreCollapsed && node?.expanded !== true)) {
        return { nextIndex: currentIndex + 1 };
    }
    // Iterate over each child and their descendants and return the
    // target node if childIndex reaches the targetIndex
    let childIndex = currentIndex + 1;
    const childCount = node.children.length;
    for (let i = 0; i < childCount; i += 1) {
        const result = getNodeDataAtTreeIndexOrNextIndex({
            ignoreCollapsed,
            getNodeKey,
            targetIndex,
            node: node.children[i],
            currentIndex: childIndex,
            lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
            path: selfPath,
        });
        if (result.node) {
            return result;
        }
        childIndex = result.nextIndex;
    }
    // If the target node is not found, return the farthest traversed index
    return { nextIndex: childIndex };
};
const getDescendantCount = ({ node, ignoreCollapsed = true, }) => {
    return (getNodeDataAtTreeIndexOrNextIndex({
        getNodeKey: () => { },
        ignoreCollapsed,
        node,
        currentIndex: 0,
        targetIndex: -1,
    }).nextIndex - 1);
};
const walkDescendants = ({ callback, getNodeKey, ignoreCollapsed, isPseudoRoot = false, node, parentNode = undefined, currentIndex, path = [], lowerSiblingCounts = [], }) => {
    // The pseudo-root is not considered in the path
    const selfPath = isPseudoRoot
        ? []
        : [...path, getNodeKey({ node, treeIndex: currentIndex })];
    const selfInfo = isPseudoRoot
        ? undefined
        : {
            node,
            parentNode,
            path: selfPath,
            lowerSiblingCounts,
            treeIndex: currentIndex,
        };
    if (!isPseudoRoot) {
        const callbackResult = callback(selfInfo);
        // Cut walk short if the callback returned false
        if (callbackResult === false) {
            return false;
        }
    }
    // Return self on nodes with no children or hidden children
    if (!node.children ||
        (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
        return currentIndex;
    }
    // Get all descendants
    let childIndex = currentIndex;
    const childCount = node.children.length;
    if (typeof node.children !== 'function') {
        for (let i = 0; i < childCount; i += 1) {
            childIndex = walkDescendants({
                callback,
                getNodeKey,
                ignoreCollapsed,
                node: node.children[i],
                parentNode: isPseudoRoot ? undefined : node,
                currentIndex: childIndex + 1,
                lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
                path: selfPath,
            });
            // Cut walk short if the callback returned false
            if (childIndex === false) {
                return false;
            }
        }
    }
    return childIndex;
};
const mapDescendants = ({ callback, getNodeKey, ignoreCollapsed, isPseudoRoot = false, node, parentNode = undefined, currentIndex, path = [], lowerSiblingCounts = [], }) => {
    const nextNode = { ...node };
    // The pseudo-root is not considered in the path
    const selfPath = isPseudoRoot
        ? []
        : [...path, getNodeKey({ node: nextNode, treeIndex: currentIndex })];
    const selfInfo = {
        node: nextNode,
        parentNode,
        path: selfPath,
        lowerSiblingCounts,
        treeIndex: currentIndex,
    };
    // Return self on nodes with no children or hidden children
    if (!nextNode.children ||
        (nextNode.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
        return {
            treeIndex: currentIndex,
            node: callback(selfInfo),
        };
    }
    // Get all descendants
    let childIndex = currentIndex;
    const childCount = nextNode.children.length;
    if (typeof nextNode.children !== 'function') {
        nextNode.children = nextNode.children.map((child, i) => {
            const mapResult = mapDescendants({
                callback,
                getNodeKey,
                ignoreCollapsed,
                node: child,
                parentNode: isPseudoRoot ? undefined : nextNode,
                currentIndex: childIndex + 1,
                lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
                path: selfPath,
            });
            childIndex = mapResult.treeIndex;
            return mapResult.node;
        });
    }
    return {
        node: callback(selfInfo),
        treeIndex: childIndex,
    };
};
const getVisibleNodeCount = ({ treeData }) => {
    const traverse = (node) => {
        if (!node.children ||
            node.expanded !== true ||
            typeof node.children === 'function') {
            return 1;
        }
        return (1 +
            node.children.reduce((total, currentNode) => total + traverse(currentNode), 0));
    };
    return treeData.reduce((total, currentNode) => total + traverse(currentNode), 0);
};
const getVisibleNodeInfoAtIndex = ({ treeData, index: targetIndex, getNodeKey, }) => {
    if (!treeData || treeData.length === 0) {
        return undefined;
    }
    // Call the tree traversal with a pseudo-root node
    const result = getNodeDataAtTreeIndexOrNextIndex({
        targetIndex,
        getNodeKey,
        node: {
            children: treeData,
            expanded: true,
        },
        currentIndex: -1,
        path: [],
        lowerSiblingCounts: [],
        isPseudoRoot: true,
    });
    if (result.node) {
        return result;
    }
    return undefined;
};
const walk = ({ treeData, getNodeKey, callback, ignoreCollapsed = true, }) => {
    if (!treeData || treeData.length === 0) {
        return;
    }
    walkDescendants({
        callback,
        getNodeKey,
        ignoreCollapsed,
        isPseudoRoot: true,
        node: { children: treeData },
        currentIndex: -1,
        path: [],
        lowerSiblingCounts: [],
    });
};
const map = ({ treeData, getNodeKey, callback, ignoreCollapsed = true, }) => {
    if (!treeData || treeData.length === 0) {
        return [];
    }
    return mapDescendants({
        callback,
        getNodeKey,
        ignoreCollapsed,
        isPseudoRoot: true,
        node: { children: treeData },
        currentIndex: -1,
        path: [],
        lowerSiblingCounts: [],
    }).node.children;
};
const toggleExpandedForAll = ({ treeData, expanded = true, }) => {
    return map({
        treeData,
        callback: ({ node }) => ({ ...node, expanded }),
        getNodeKey: ({ treeIndex }) => treeIndex,
        ignoreCollapsed: false,
    });
};
const changeNodeAtPath = ({ treeData, path, newNode, getNodeKey, ignoreCollapsed = true, }) => {
    const RESULT_MISS = 'RESULT_MISS';
    const traverse = ({ isPseudoRoot = false, node, currentTreeIndex, pathIndex, }) => {
        if (!isPseudoRoot &&
            getNodeKey({ node, treeIndex: currentTreeIndex }) !== path[pathIndex]) {
            return RESULT_MISS;
        }
        if (pathIndex >= path.length - 1) {
            // If this is the final location in the path, return its changed form
            return typeof newNode === 'function'
                ? newNode({ node, treeIndex: currentTreeIndex })
                : newNode;
        }
        if (!node.children) {
            // If this node is part of the path, but has no children, return the unchanged node
            throw new Error('Path referenced children of node with no children.');
        }
        let nextTreeIndex = currentTreeIndex + 1;
        for (let i = 0; i < node.children.length; i += 1) {
            const result = traverse({
                node: node.children[i],
                currentTreeIndex: nextTreeIndex,
                pathIndex: pathIndex + 1,
            });
            // If the result went down the correct path
            if (result !== RESULT_MISS) {
                if (result) {
                    // If the result was truthy (in this case, an object),
                    //  pass it to the next level of recursion up
                    return {
                        ...node,
                        children: [
                            ...node.children.slice(0, i),
                            result,
                            ...node.children.slice(i + 1),
                        ],
                    };
                }
                // If the result was falsy (returned from the newNode function), then
                //  delete the node from the array.
                return {
                    ...node,
                    children: [
                        ...node.children.slice(0, i),
                        ...node.children.slice(i + 1),
                    ],
                };
            }
            nextTreeIndex +=
                1 + getDescendantCount({ node: node.children[i], ignoreCollapsed });
        }
        return RESULT_MISS;
    };
    // Use a pseudo-root node in the beginning traversal
    const result = traverse({
        node: { children: treeData },
        currentTreeIndex: -1,
        pathIndex: -1,
        isPseudoRoot: true,
    });
    if (result === RESULT_MISS) {
        throw new Error('No node found at the given path.');
    }
    return result.children;
};
const removeNodeAtPath = ({ treeData, path, getNodeKey, ignoreCollapsed = true, }) => {
    return changeNodeAtPath({
        treeData,
        path,
        getNodeKey,
        ignoreCollapsed,
        newNode: undefined, // Delete the node
    });
};
const removeNode = ({ treeData, path, getNodeKey, ignoreCollapsed = true, }) => {
    let removedNode;
    let removedTreeIndex;
    const nextTreeData = changeNodeAtPath({
        treeData,
        path,
        getNodeKey,
        ignoreCollapsed,
        newNode: ({ node, treeIndex }) => {
            // Store the target node and delete it from the tree
            removedNode = node;
            removedTreeIndex = treeIndex;
            return undefined;
        },
    });
    return {
        treeData: nextTreeData,
        node: removedNode,
        treeIndex: removedTreeIndex,
    };
};
const getNodeAtPath = ({ treeData, path, getNodeKey, ignoreCollapsed = true, }) => {
    let foundNodeInfo;
    try {
        changeNodeAtPath({
            treeData,
            path,
            getNodeKey,
            ignoreCollapsed,
            newNode: ({ node, treeIndex }) => {
                foundNodeInfo = { node, treeIndex };
                return node;
            },
        });
    }
    catch {
        // Ignore the error -- the null return will be explanation enough
    }
    return foundNodeInfo;
};
const addNodeUnderParent = ({ treeData, newNode, parentKey = undefined, getNodeKey, ignoreCollapsed = true, expandParent = false, addAsFirstChild = false, }) => {
    if (parentKey === null || parentKey === undefined) {
        return addAsFirstChild
            ? {
                treeData: [newNode, ...(treeData || [])],
                treeIndex: 0,
            }
            : {
                treeData: [...(treeData || []), newNode],
                treeIndex: (treeData || []).length,
            };
    }
    let insertedTreeIndex;
    let hasBeenAdded = false;
    const changedTreeData = map({
        treeData,
        getNodeKey,
        ignoreCollapsed,
        callback: ({ node, treeIndex, path }) => {
            const key = path ? path.at(-1) : undefined;
            // Return nodes that are not the parent as-is
            if (hasBeenAdded || key !== parentKey) {
                return node;
            }
            hasBeenAdded = true;
            const parentNode = {
                ...node,
            };
            if (expandParent) {
                parentNode.expanded = true;
            }
            // If no children exist yet, just add the single newNode
            if (!parentNode.children) {
                insertedTreeIndex = treeIndex + 1;
                return {
                    ...parentNode,
                    children: [newNode],
                };
            }
            if (typeof parentNode.children === 'function') {
                throw new TypeError('Cannot add to children defined by a function');
            }
            let nextTreeIndex = treeIndex + 1;
            for (let i = 0; i < parentNode.children.length; i += 1) {
                nextTreeIndex +=
                    1 +
                        getDescendantCount({ node: parentNode.children[i], ignoreCollapsed });
            }
            insertedTreeIndex = nextTreeIndex;
            const children = addAsFirstChild
                ? [newNode, ...parentNode.children]
                : [...parentNode.children, newNode];
            return {
                ...parentNode,
                children,
            };
        },
    });
    if (!hasBeenAdded) {
        throw new Error('No node found with the given key.');
    }
    return {
        treeData: changedTreeData,
        treeIndex: insertedTreeIndex,
    };
};
const addNodeAtDepthAndIndex = ({ targetDepth, minimumTreeIndex, newNode, ignoreCollapsed, expandParent, isPseudoRoot = false, isLastChild, node, currentIndex, currentDepth, getNodeKey, path = [], }) => {
    const selfPath = (n) => isPseudoRoot
        ? []
        : [...path, getNodeKey({ node: n, treeIndex: currentIndex })];
    // If the current position is the only possible place to add, add it
    if (currentIndex >= minimumTreeIndex - 1 ||
        (isLastChild && !(node.children && node.children.length > 0))) {
        if (typeof node.children === 'function') {
            throw new TypeError('Cannot add to children defined by a function');
        }
        else {
            const extraNodeProps = expandParent ? { expanded: true } : {};
            const nextNode = {
                ...node,
                ...extraNodeProps,
                children: node.children ? [newNode, ...node.children] : [newNode],
            };
            return {
                node: nextNode,
                nextIndex: currentIndex + 2,
                insertedTreeIndex: currentIndex + 1,
                parentPath: selfPath(nextNode),
                parentNode: isPseudoRoot ? undefined : nextNode,
            };
        }
    }
    // If this is the target depth for the insertion,
    // i.e., where the newNode can be added to the current node's children
    if (currentDepth >= targetDepth - 1) {
        // Skip over nodes with no children or hidden children
        if (!node.children ||
            typeof node.children === 'function' ||
            (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
            return { node, nextIndex: currentIndex + 1 };
        }
        // Scan over the children to see if there's a place among them that fulfills
        // the minimumTreeIndex requirement
        let childIndex = currentIndex + 1;
        let insertedTreeIndex;
        let insertIndex;
        for (let i = 0; i < node.children.length; i += 1) {
            // If a valid location is found, mark it as the insertion location and
            // break out of the loop
            if (childIndex >= minimumTreeIndex) {
                insertedTreeIndex = childIndex;
                insertIndex = i;
                break;
            }
            // Increment the index by the child itself plus the number of descendants it has
            childIndex +=
                1 + getDescendantCount({ node: node.children[i], ignoreCollapsed });
        }
        // If no valid indices to add the node were found
        if (insertIndex === null || insertIndex === undefined) {
            // If the last position in this node's children is less than the minimum index
            // and there are more children on the level of this node, return without insertion
            if (childIndex < minimumTreeIndex && !isLastChild) {
                return { node, nextIndex: childIndex };
            }
            // Use the last position in the children array to insert the newNode
            insertedTreeIndex = childIndex;
            insertIndex = node.children.length;
        }
        // Insert the newNode at the insertIndex
        const nextNode = {
            ...node,
            children: [
                ...node.children.slice(0, insertIndex),
                newNode,
                ...node.children.slice(insertIndex),
            ],
        };
        // Return node with successful insert result
        return {
            node: nextNode,
            nextIndex: childIndex,
            insertedTreeIndex,
            parentPath: selfPath(nextNode),
            parentNode: isPseudoRoot ? undefined : nextNode,
        };
    }
    // Skip over nodes with no children or hidden children
    if (!node.children ||
        typeof node.children === 'function' ||
        (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
        return { node, nextIndex: currentIndex + 1 };
    }
    // Get all descendants
    let insertedTreeIndex;
    let pathFragment;
    let parentNode;
    let childIndex = currentIndex + 1;
    let newChildren = node.children;
    if (typeof newChildren !== 'function') {
        newChildren = newChildren.map((child, i) => {
            if (insertedTreeIndex !== null && insertedTreeIndex !== undefined) {
                return child;
            }
            const mapResult = addNodeAtDepthAndIndex({
                targetDepth,
                minimumTreeIndex,
                newNode,
                ignoreCollapsed,
                expandParent,
                isLastChild: isLastChild && i === newChildren.length - 1,
                node: child,
                currentIndex: childIndex,
                currentDepth: currentDepth + 1,
                getNodeKey,
                path: [], // Cannot determine the parent path until the children have been processed
            });
            if ('insertedTreeIndex' in mapResult) {
                ({
                    insertedTreeIndex,
                    parentNode,
                    parentPath: pathFragment,
                } = mapResult);
            }
            childIndex = mapResult.nextIndex;
            return mapResult.node;
        });
    }
    const nextNode = { ...node, children: newChildren };
    const result = {
        node: nextNode,
        nextIndex: childIndex,
    };
    if (insertedTreeIndex !== null && insertedTreeIndex !== undefined) {
        result.insertedTreeIndex = insertedTreeIndex;
        result.parentPath = [...selfPath(nextNode), ...pathFragment];
        result.parentNode = parentNode;
    }
    return result;
};
const insertNode = ({ treeData, depth: targetDepth, minimumTreeIndex, newNode, getNodeKey, ignoreCollapsed = true, expandParent = false, }) => {
    if (!treeData && targetDepth === 0) {
        return {
            treeData: [newNode],
            treeIndex: 0,
            path: [getNodeKey({ node: newNode, treeIndex: 0 })],
            parentNode: undefined,
        };
    }
    const insertResult = addNodeAtDepthAndIndex({
        targetDepth,
        minimumTreeIndex,
        newNode,
        ignoreCollapsed,
        expandParent,
        getNodeKey,
        isPseudoRoot: true,
        isLastChild: true,
        node: { children: treeData },
        currentIndex: -1,
        currentDepth: -1,
    });
    if (!('insertedTreeIndex' in insertResult)) {
        throw new Error('No suitable position found to insert.');
    }
    const treeIndex = insertResult.insertedTreeIndex;
    return {
        treeData: insertResult.node.children,
        treeIndex,
        path: [
            ...insertResult.parentPath,
            getNodeKey({ node: newNode, treeIndex }),
        ],
        parentNode: insertResult.parentNode,
    };
};
const getFlatDataFromTree = ({ treeData, getNodeKey, ignoreCollapsed = true, }) => {
    if (!treeData || treeData.length === 0) {
        return [];
    }
    const flattened = [];
    walk({
        treeData,
        getNodeKey,
        ignoreCollapsed,
        callback: (nodeInfo) => {
            flattened.push(nodeInfo);
        },
    });
    return flattened;
};
const getTreeFromFlatData = ({ flatData, getKey = (node) => node.id, getParentKey = (node) => node.parentId, rootKey = '0', }) => {
    if (!flatData) {
        return [];
    }
    const childrenToParents = {};
    for (const child of flatData) {
        const parentKey = getParentKey(child);
        if (parentKey in childrenToParents) {
            childrenToParents[parentKey].push(child);
        }
        else {
            childrenToParents[parentKey] = [child];
        }
    }
    if (!(rootKey in childrenToParents)) {
        return [];
    }
    const trav = (parent) => {
        const parentKey = getKey(parent);
        if (parentKey in childrenToParents) {
            return {
                ...parent,
                children: childrenToParents[parentKey].map((child) => trav(child)),
            };
        }
        return { ...parent };
    };
    return childrenToParents[rootKey].map((child) => trav(child));
};
const isDescendant = (older, younger) => {
    return (!!older.children &&
        typeof older.children !== 'function' &&
        older.children.some((child) => child === younger || isDescendant(child, younger)));
};
const getDepth = (node, depth = 0) => {
    if (!node.children) {
        return depth;
    }
    if (typeof node.children === 'function') {
        return depth + 1;
    }
    return node.children.reduce((deepest, child) => Math.max(deepest, getDepth(child, depth + 1)), depth);
};
const find = ({ getNodeKey, treeData, searchQuery, searchMethod, searchFocusOffset, expandAllMatchPaths = false, expandFocusMatchPaths = true, }) => {
    let matchCount = 0;
    const trav = ({ isPseudoRoot = false, node, currentIndex, path = [] }) => {
        let matches = [];
        let isSelfMatch = false;
        let hasFocusMatch = false;
        // The pseudo-root is not considered in the path
        const selfPath = isPseudoRoot
            ? []
            : [...path, getNodeKey({ node, treeIndex: currentIndex })];
        const extraInfo = isPseudoRoot
            ? undefined
            : {
                path: selfPath,
                treeIndex: currentIndex,
            };
        // Nodes with with children that aren't lazy
        const hasChildren = node.children &&
            typeof node.children !== 'function' &&
            node.children.length > 0;
        // Examine the current node to see if it is a match
        if (!isPseudoRoot && searchMethod({ ...extraInfo, node, searchQuery })) {
            if (matchCount === searchFocusOffset) {
                hasFocusMatch = true;
            }
            // Keep track of the number of matching nodes, so we know when the searchFocusOffset
            //  is reached
            matchCount += 1;
            // We cannot add this node to the matches right away, as it may be changed
            //  during the search of the descendants. The entire node is used in
            //  comparisons between nodes inside the `matches` and `treeData` results
            //  of this method (`find`)
            isSelfMatch = true;
        }
        let childIndex = currentIndex;
        const newNode = { ...node };
        if (hasChildren) {
            // Get all descendants
            newNode.children = newNode.children.map((child) => {
                const mapResult = trav({
                    node: child,
                    currentIndex: childIndex + 1,
                    path: selfPath,
                });
                // Ignore hidden nodes by only advancing the index counter to the returned treeIndex
                // if the child is expanded.
                //
                // The child could have been expanded from the start,
                // or expanded due to a matching node being found in its descendants
                if (mapResult.node.expanded) {
                    childIndex = mapResult.treeIndex;
                }
                else {
                    childIndex += 1;
                }
                if (mapResult.matches.length > 0 || mapResult.hasFocusMatch) {
                    matches = [...matches, ...mapResult.matches];
                    if (mapResult.hasFocusMatch) {
                        hasFocusMatch = true;
                    }
                    // Expand the current node if it has descendants matching the search
                    // and the settings are set to do so.
                    if ((expandAllMatchPaths && mapResult.matches.length > 0) ||
                        ((expandAllMatchPaths || expandFocusMatchPaths) &&
                            mapResult.hasFocusMatch)) {
                        newNode.expanded = true;
                    }
                }
                return mapResult.node;
            });
        }
        // Cannot assign a treeIndex to hidden nodes
        if (!isPseudoRoot && !newNode.expanded) {
            matches = matches.map((match) => ({
                ...match,
                treeIndex: undefined,
            }));
        }
        // Add this node to the matches if it fits the search criteria.
        // This is performed at the last minute so newNode can be sent in its final form.
        if (isSelfMatch) {
            matches = [{ ...extraInfo, node: newNode }, ...matches];
        }
        return {
            node: matches.length > 0 ? newNode : node,
            matches,
            hasFocusMatch,
            treeIndex: childIndex,
        };
    };
    const result = trav({
        node: { children: treeData },
        isPseudoRoot: true,
        currentIndex: -1,
    });
    return {
        matches: result.matches,
        treeData: result.node.children,
    };
};

// very simple className utility for creating a classname string...
// Falsy arguments are ignored:
//
// const active = true
// const className = classnames(
//    "class1",
//    !active && "class2",
//    active && "class3"
// ); // returns -> class1 class3";
//
// Use Boolean constructor as a filter callback
// Allows for loose type truthy/falsey checks
// Boolean("") === false;
// Boolean(false) === false;
// Boolean(undefined) === false;
// Boolean(null) === false;
// Boolean(0) === false;
// Boolean("classname") === true;
const classnames = (...classes) => classes.filter(Boolean).join(' ');

var css_248z$2 = ".rst__rowWrapper {\r\n  padding: 10px 10px 10px 0;\r\n  height: 100%;\r\n  box-sizing: border-box;\r\n}\r\n\r\n.rst__rtl.rst__rowWrapper {\r\n  padding: 10px 0 10px 10px;\r\n}\r\n\r\n.rst__row {\r\n  height: 100%;\r\n  white-space: nowrap;\r\n  display: flex;\r\n}\r\n.rst__row > * {\r\n  box-sizing: border-box;\r\n}\r\n\r\n/**\r\n * The outline of where the element will go if dropped, displayed while dragging\r\n */\r\n.rst__rowLandingPad,\r\n.rst__rowCancelPad {\r\n  border: none !important;\r\n  box-shadow: none !important;\r\n  outline: none !important;\r\n}\r\n.rst__rowLandingPad > *,\r\n.rst__rowCancelPad > * {\r\n  opacity: 0 !important;\r\n}\r\n.rst__rowLandingPad::before,\r\n.rst__rowCancelPad::before {\r\n  background-color: lightblue;\r\n  border: 3px dashed white;\r\n  content: '';\r\n  position: absolute;\r\n  top: 0;\r\n  right: 0;\r\n  bottom: 0;\r\n  left: 0;\r\n  z-index: -1;\r\n}\r\n\r\n/**\r\n * Alternate appearance of the landing pad when the dragged location is invalid\r\n */\r\n.rst__rowCancelPad::before {\r\n  background-color: #e6a8ad;\r\n}\r\n\r\n/**\r\n * Nodes matching the search conditions are highlighted\r\n */\r\n.rst__rowSearchMatch {\r\n  outline: solid 3px #0080ff;\r\n}\r\n\r\n/**\r\n * The node that matches the search conditions and is currently focused\r\n */\r\n.rst__rowSearchFocus {\r\n  outline: solid 3px #fc6421;\r\n}\r\n\r\n.rst__rowContents,\r\n.rst__rowLabel,\r\n.rst__rowToolbar,\r\n.rst__moveHandle,\r\n.rst__toolbarButton {\r\n  display: inline-block;\r\n  vertical-align: middle;\r\n}\r\n\r\n.rst__rowContents {\r\n  position: relative;\r\n  height: 100%;\r\n  border: solid #bbb 1px;\r\n  border-left: none;\r\n  box-shadow: 0 2px 2px -2px;\r\n  padding: 0 5px 0 10px;\r\n  border-radius: 2px;\r\n  min-width: 230px;\r\n  flex: 1 0 auto;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n}\r\n\r\n.rst__rtl.rst__rowContents {\r\n  border-right: none;\r\n  border-left: solid #bbb 1px;\r\n  padding: 0 10px 0 5px;\r\n}\r\n\r\n.rst__rowContentsDragDisabled {\r\n  border-left: solid #bbb 1px;\r\n}\r\n\r\n.rst__rtl.rst__rowContentsDragDisabled {\r\n  border-right: solid #bbb 1px;\r\n  border-left: solid #bbb 1px;\r\n}\r\n\r\n.rst__rowLabel {\r\n  flex: 0 1 auto;\r\n  padding-right: 20px;\r\n}\r\n.rst__rtl.rst__rowLabel {\r\n  padding-left: 20px;\r\n  padding-right: inherit;\r\n}\r\n\r\n.rst__rowToolbar {\r\n  flex: 0 1 auto;\r\n  display: flex;\r\n}\r\n\r\n.rst__moveHandle,\r\n.rst__loadingHandle {\r\n  height: 100%;\r\n  width: 44px;\r\n  background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MiIgaGVpZ2h0PSI0MiI+PGcgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIuOSIgPjxwYXRoIGQ9Ik0xNCAxNS43aDE0LjQiLz48cGF0aCBkPSJNMTQgMjEuNGgxNC40Ii8+PHBhdGggZD0iTTE0IDI3LjFoMTQuNCIvPjwvZz4KPC9zdmc+');\r\n  background-color: #6DB3F2;\r\n  background-position: center;\r\n  border: solid #aaa 1px;\r\n  box-shadow: 0 2px 2px -2px;\r\n  cursor: move;\r\n  border-radius: 1px;\r\n  z-index: 1;\r\n}\r\n\r\n.rst__loadingHandle {\r\n  cursor: default;\r\n  background: #d9d9d9;\r\n}\r\n\r\n@keyframes pointFade {\r\n  0%,\r\n  19.999%,\r\n  100% {\r\n    opacity: 0;\r\n  }\r\n  20% {\r\n    opacity: 1;\r\n  }\r\n}\r\n\r\n.rst__loadingCircle {\r\n  width: 80%;\r\n  height: 80%;\r\n  margin: 10%;\r\n  position: relative;\r\n}\r\n\r\n.rst__loadingCirclePoint {\r\n  width: 100%;\r\n  height: 100%;\r\n  position: absolute;\r\n  left: 0;\r\n  top: 0;\r\n}\r\n\r\n.rst__rtl.rst__loadingCirclePoint {\r\n  right: 0;\r\n  left: initial;\r\n}\r\n\r\n.rst__loadingCirclePoint::before {\r\n  content: '';\r\n  display: block;\r\n  margin: 0 auto;\r\n  width: 11%;\r\n  height: 30%;\r\n  background-color: #fff;\r\n  border-radius: 30%;\r\n  animation: pointFade 800ms infinite ease-in-out both;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(1) {\r\n  transform: rotate(0deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(7) {\r\n  transform: rotate(180deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(1)::before,\r\n.rst__loadingCirclePoint:nth-of-type(7)::before {\r\n  animation-delay: -800ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(2) {\r\n  transform: rotate(30deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(8) {\r\n  transform: rotate(210deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(2)::before,\r\n.rst__loadingCirclePoint:nth-of-type(8)::before {\r\n  animation-delay: -666ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(3) {\r\n  transform: rotate(60deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(9) {\r\n  transform: rotate(240deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(3)::before,\r\n.rst__loadingCirclePoint:nth-of-type(9)::before {\r\n  animation-delay: -533ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(4) {\r\n  transform: rotate(90deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(10) {\r\n  transform: rotate(270deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(4)::before,\r\n.rst__loadingCirclePoint:nth-of-type(10)::before {\r\n  animation-delay: -400ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(5) {\r\n  transform: rotate(120deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(11) {\r\n  transform: rotate(300deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(5)::before,\r\n.rst__loadingCirclePoint:nth-of-type(11)::before {\r\n  animation-delay: -266ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(6) {\r\n  transform: rotate(150deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(12) {\r\n  transform: rotate(330deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(6)::before,\r\n.rst__loadingCirclePoint:nth-of-type(12)::before {\r\n  animation-delay: -133ms;\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(7) {\r\n  transform: rotate(180deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(13) {\r\n  transform: rotate(360deg);\r\n}\r\n.rst__loadingCirclePoint:nth-of-type(7)::before,\r\n.rst__loadingCirclePoint:nth-of-type(13)::before {\r\n  animation-delay: 0ms;\r\n}\r\n\r\n.rst__rowTitle {\r\n  font-weight: bold;\r\n}\r\n\r\n.rst__rowTitleWithSubtitle {\r\n  font-size: 85%;\r\n  display: block;\r\n  height: 0.8rem;\r\n}\r\n\r\n.rst__rowSubtitle {\r\n  font-size: 70%;\r\n  line-height: 1;\r\n}\r\n\r\n.rst__collapseButton,\r\n.rst__expandButton {\r\n  appearance: none;\r\n  border: none;\r\n  position: absolute;\r\n  border-radius: 100%;\r\n  box-shadow: 0 0 0 1px #000;\r\n  width: 16px;\r\n  height: 16px;\r\n  padding: 0;\r\n  top: 50%;\r\n  transform: translate(-50%, -50%);\r\n  cursor: pointer;\r\n}\r\n.rst__rtl.rst__collapseButton,\r\n.rst__rtl.rst__expandButton {\r\n  transform: translate(50%, -50%);\r\n}\r\n.rst__collapseButton:focus,\r\n.rst__expandButton:focus {\r\n  outline: none;\r\n  box-shadow: 0 0 0 1px #000, 0 0 1px 3px #83bef9;\r\n}\r\n.rst__collapseButton:hover:not(:active),\r\n.rst__expandButton:hover:not(:active) {\r\n  background-size: 24px;\r\n  height: 20px;\r\n  width: 20px;\r\n}\r\n\r\n.rst__collapseButton {\r\n  background: #fff\r\n    url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCI+PGNpcmNsZSBjeD0iOSIgY3k9IjkiIHI9IjgiIGZpbGw9IiNGRkYiLz48ZyBzdHJva2U9IiM5ODk4OTgiIHN0cm9rZS13aWR0aD0iMS45IiA+PHBhdGggZD0iTTQuNSA5aDkiLz48L2c+Cjwvc3ZnPg==')\r\n    no-repeat center;\r\n}\r\n\r\n.rst__expandButton {\r\n  background: #fff\r\n    url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCI+PGNpcmNsZSBjeD0iOSIgY3k9IjkiIHI9IjgiIGZpbGw9IiNGRkYiLz48ZyBzdHJva2U9IiM5ODk4OTgiIHN0cm9rZS13aWR0aD0iMS45IiA+PHBhdGggZD0iTTQuNSA5aDkiLz48cGF0aCBkPSJNOSA0LjV2OSIvPjwvZz4KPC9zdmc+')\r\n    no-repeat center;\r\n}\r\n\r\n/**\r\n * Line for under a node with children\r\n */\r\n.rst__lineChildren {\r\n  height: 100%;\r\n  display: inline-block;\r\n  position: absolute;\r\n}\r\n.rst__lineChildren::after {\r\n  content: '';\r\n  position: absolute;\r\n  background-color: black;\r\n  width: 1px;\r\n  left: 50%;\r\n  bottom: 0;\r\n  height: 10px;\r\n}\r\n\r\n.rst__rtl.rst__lineChildren::after {\r\n  right: 50%;\r\n  left: initial;\r\n}\r\n";
styleInject(css_248z$2);

const defaultProps$3 = {
    isSearchMatch: false,
    isSearchFocus: false,
    canDrag: false,
    toggleChildrenVisibility: undefined,
    buttons: [],
    className: '',
    style: {},
    parentNode: undefined,
    draggedNode: undefined,
    canDrop: false,
    title: undefined,
    subtitle: undefined,
    rowDirection: 'ltr',
};
const NodeRendererDefault = (props) => {
    props = { ...defaultProps$3, ...props };
    const { scaffoldBlockPxWidth, toggleChildrenVisibility, connectDragPreview, connectDragSource, isDragging, canDrop, canDrag, node, title, subtitle, draggedNode, path, treeIndex, isSearchMatch, isSearchFocus, buttons, className, style, didDrop, treeId: _treeId, isOver: _isOver, // Not needed, but preserved for other renderers
    parentNode: _parentNode, // Needed for dndManager
    rowDirection, ...otherProps } = props;
    const nodeTitle = title || node.title;
    const nodeSubtitle = subtitle || node.subtitle;
    const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;
    let handle;
    if (canDrag) {
        handle =
            typeof node.children === 'function' && node.expanded ? (React.createElement("div", { className: "rst__loadingHandle" },
                React.createElement("div", { className: "rst__loadingCircle" }, Array.from({ length: 12 }).map((_, index) => (React.createElement("div", { key: index, className: classnames('rst__loadingCirclePoint', rowDirectionClass ?? '') })))))) : (connectDragSource(React.createElement("div", { className: "rst__moveHandle" }), {
                dropEffect: 'copy',
            }));
    }
    const isDraggedDescendant = draggedNode && isDescendant(draggedNode, node);
    const isLandingPadActive = !didDrop && isDragging;
    let buttonStyle = { left: -0.5 * scaffoldBlockPxWidth, right: 0 };
    if (rowDirection === 'rtl') {
        buttonStyle = { right: -0.5 * scaffoldBlockPxWidth, left: 0 };
    }
    return (React.createElement("div", { style: { height: '100%' }, ...otherProps },
        toggleChildrenVisibility &&
            node.children &&
            (node.children.length > 0 || typeof node.children === 'function') && (React.createElement("div", null,
            React.createElement("button", { type: "button", "aria-label": node.expanded ? 'Collapse' : 'Expand', className: classnames(node.expanded ? 'rst__collapseButton' : 'rst__expandButton', rowDirectionClass ?? ''), style: buttonStyle, onClick: () => toggleChildrenVisibility({
                    node,
                    path,
                    treeIndex,
                }) }),
            node.expanded && !isDragging && (React.createElement("div", { style: { width: scaffoldBlockPxWidth }, className: classnames('rst__lineChildren', rowDirectionClass ?? '') })))),
        React.createElement("div", { className: classnames('rst__rowWrapper', rowDirectionClass ?? '') }, connectDragPreview(React.createElement("div", { className: classnames('rst__row', isLandingPadActive ? 'rst__rowLandingPad' : '', isLandingPadActive && !canDrop ? 'rst__rowCancelPad' : '', isSearchMatch ? 'rst__rowSearchMatch' : '', isSearchFocus ? 'rst__rowSearchFocus' : '', rowDirectionClass ?? '', className ?? ''), style: {
                opacity: isDraggedDescendant ? 0.5 : 1,
                ...style,
            } },
            handle,
            React.createElement("div", { className: classnames('rst__rowContents', canDrag ? '' : 'rst__rowContentsDragDisabled', rowDirectionClass ?? '') },
                React.createElement("div", { className: classnames('rst__rowLabel', rowDirectionClass ?? '') },
                    React.createElement("span", { className: classnames('rst__rowTitle', node.subtitle ? 'rst__rowTitleWithSubtitle' : '') }, typeof nodeTitle === 'function'
                        ? nodeTitle({
                            node,
                            path,
                            treeIndex,
                        })
                        : nodeTitle),
                    nodeSubtitle && (React.createElement("span", { className: "rst__rowSubtitle" }, typeof nodeSubtitle === 'function'
                        ? nodeSubtitle({
                            node,
                            path,
                            treeIndex,
                        })
                        : nodeSubtitle))),
                React.createElement("div", { className: "rst__rowToolbar" }, buttons?.map((btn, index) => (React.createElement("div", { key: index, className: "rst__toolbarButton" }, btn))))))))));
};

var css_248z$1 = ".rst__placeholder {\r\n  position: relative;\r\n  height: 68px;\r\n  max-width: 300px;\r\n  padding: 10px;\r\n}\r\n.rst__placeholder,\r\n.rst__placeholder > * {\r\n  box-sizing: border-box;\r\n}\r\n.rst__placeholder::before {\r\n  border: 3px dashed #d9d9d9;\r\n  content: '';\r\n  position: absolute;\r\n  top: 5px;\r\n  right: 5px;\r\n  bottom: 5px;\r\n  left: 5px;\r\n  z-index: -1;\r\n}\r\n\r\n/**\r\n * The outline of where the element will go if dropped, displayed while dragging\r\n */\r\n.rst__placeholderLandingPad,\r\n.rst__placeholderCancelPad {\r\n  border: none !important;\r\n  box-shadow: none !important;\r\n  outline: none !important;\r\n}\r\n.rst__placeholderLandingPad *,\r\n.rst__placeholderCancelPad * {\r\n  opacity: 0 !important;\r\n}\r\n.rst__placeholderLandingPad::before,\r\n.rst__placeholderCancelPad::before {\r\n  background-color: lightblue;\r\n  border-color: white;\r\n}\r\n\r\n/**\r\n * Alternate appearance of the landing pad when the dragged location is invalid\r\n */\r\n.rst__placeholderCancelPad::before {\r\n  background-color: #e6a8ad;\r\n}\r\n";
styleInject(css_248z$1);

const defaultProps$2 = {
    isOver: false,
    canDrop: false,
};
const PlaceholderRendererDefault = (props) => {
    props = { ...defaultProps$2, ...props };
    const { canDrop, isOver } = props;
    return (React.createElement("div", { className: classnames('rst__placeholder', canDrop ? 'rst__placeholderLandingPad' : '', canDrop && !isOver ? 'rst__placeholderCancelPad' : '') }));
};

var css_248z = ".rst__node {\r\n  min-width: 100%;\r\n  white-space: nowrap;\r\n  position: relative;\r\n  text-align: left;\r\n  height: 62px;\r\n}\r\n\r\n.rst__node.rst__rtl {\r\n  text-align: right;\r\n}\r\n\r\n.rst__nodeContent {\r\n  position: absolute;\r\n  top: 0;\r\n  bottom: 0;\r\n}\r\n\r\n/* ==========================================================================\r\n   Scaffold\r\n\r\n    Line-overlaid blocks used for showing the tree structure\r\n   ========================================================================== */\r\n.rst__lineBlock,\r\n.rst__absoluteLineBlock {\r\n  height: 100%;\r\n  position: relative;\r\n  display: inline-block;\r\n}\r\n\r\n.rst__absoluteLineBlock {\r\n  position: absolute;\r\n  top: 0;\r\n}\r\n\r\n.rst__lineHalfHorizontalRight::before,\r\n.rst__lineFullVertical::after,\r\n.rst__lineHalfVerticalTop::after,\r\n.rst__lineHalfVerticalBottom::after {\r\n  position: absolute;\r\n  content: '';\r\n  background-color: black;\r\n}\r\n\r\n/**\r\n * +-----+\r\n * |     |\r\n * |  +--+\r\n * |     |\r\n * +-----+\r\n */\r\n.rst__lineHalfHorizontalRight::before {\r\n  height: 1px;\r\n  top: 50%;\r\n  right: 0;\r\n  width: 50%;\r\n}\r\n\r\n.rst__rtl.rst__lineHalfHorizontalRight::before {\r\n  left: 0;\r\n  right: initial;\r\n}\r\n\r\n/**\r\n * +--+--+\r\n * |  |  |\r\n * |  |  |\r\n * |  |  |\r\n * +--+--+\r\n */\r\n.rst__lineFullVertical::after,\r\n.rst__lineHalfVerticalTop::after,\r\n.rst__lineHalfVerticalBottom::after {\r\n  width: 1px;\r\n  left: 50%;\r\n  top: 0;\r\n  height: 100%;\r\n}\r\n\r\n/**\r\n * +--+--+\r\n * |  |  |\r\n * |  |  |\r\n * |  |  |\r\n * +--+--+\r\n */\r\n.rst__rtl.rst__lineFullVertical::after,\r\n.rst__rtl.rst__lineHalfVerticalTop::after,\r\n.rst__rtl.rst__lineHalfVerticalBottom::after {\r\n  right: 50%;\r\n  left: initial;\r\n}\r\n\r\n/**\r\n * +-----+\r\n * |  |  |\r\n * |  +  |\r\n * |     |\r\n * +-----+\r\n */\r\n.rst__lineHalfVerticalTop::after {\r\n  height: 50%;\r\n}\r\n\r\n/**\r\n * +-----+\r\n * |     |\r\n * |  +  |\r\n * |  |  |\r\n * +-----+\r\n */\r\n.rst__lineHalfVerticalBottom::after {\r\n  top: auto;\r\n  bottom: 0;\r\n  height: 50%;\r\n}\r\n\r\n/* Highlight line for pointing to dragged row destination\r\n   ========================================================================== */\r\n/**\r\n * +--+--+\r\n * |  |  |\r\n * |  |  |\r\n * |  |  |\r\n * +--+--+\r\n */\r\n.rst__highlightLineVertical {\r\n  z-index: 3;\r\n}\r\n.rst__highlightLineVertical::before {\r\n  position: absolute;\r\n  content: '';\r\n  background-color: #36c2f6;\r\n  width: 8px;\r\n  margin-left: -4px;\r\n  left: 50%;\r\n  top: 0;\r\n  height: 100%;\r\n}\r\n\r\n.rst__rtl.rst__highlightLineVertical::before {\r\n  margin-left: initial;\r\n  margin-right: -4px;\r\n  left: initial;\r\n  right: 50%;\r\n}\r\n\r\n@keyframes arrow-pulse {\r\n  0% {\r\n    transform: translate(0, 0);\r\n    opacity: 0;\r\n  }\r\n  30% {\r\n    transform: translate(0, 300%);\r\n    opacity: 1;\r\n  }\r\n  70% {\r\n    transform: translate(0, 700%);\r\n    opacity: 1;\r\n  }\r\n  100% {\r\n    transform: translate(0, 1000%);\r\n    opacity: 0;\r\n  }\r\n}\r\n.rst__highlightLineVertical::after {\r\n  content: '';\r\n  position: absolute;\r\n  height: 0;\r\n  margin-left: -4px;\r\n  left: 50%;\r\n  top: 0;\r\n  border-left: 4px solid transparent;\r\n  border-right: 4px solid transparent;\r\n  border-top: 4px solid white;\r\n  animation: arrow-pulse 1s infinite linear both;\r\n}\r\n\r\n.rst__rtl.rst__highlightLineVertical::after {\r\n  margin-left: initial;\r\n  margin-right: -4px;\r\n  right: 50%;\r\n  left: initial;\r\n}\r\n\r\n/**\r\n * +-----+\r\n * |     |\r\n * |  +--+\r\n * |  |  |\r\n * +--+--+\r\n */\r\n.rst__highlightTopLeftCorner::before {\r\n  z-index: 3;\r\n  content: '';\r\n  position: absolute;\r\n  border-top: solid 8px #36c2f6;\r\n  border-left: solid 8px #36c2f6;\r\n  box-sizing: border-box;\r\n  height: calc(50% + 4px);\r\n  top: 50%;\r\n  margin-top: -4px;\r\n  right: 0;\r\n  width: calc(50% + 4px);\r\n}\r\n\r\n.rst__rtl.rst__highlightTopLeftCorner::before {\r\n  border-right: solid 8px #36c2f6;\r\n  border-left: none;\r\n  left: 0;\r\n  right: initial;\r\n}\r\n\r\n/**\r\n * +--+--+\r\n * |  |  |\r\n * |  |  |\r\n * |  +->|\r\n * +-----+\r\n */\r\n.rst__highlightBottomLeftCorner {\r\n  z-index: 3;\r\n}\r\n.rst__highlightBottomLeftCorner::before {\r\n  content: '';\r\n  position: absolute;\r\n  border-bottom: solid 8px #36c2f6;\r\n  border-left: solid 8px #36c2f6;\r\n  box-sizing: border-box;\r\n  height: calc(100% + 4px);\r\n  top: 0;\r\n  right: 12px;\r\n  width: calc(50% - 8px);\r\n}\r\n\r\n.rst__rtl.rst__highlightBottomLeftCorner::before {\r\n  border-right: solid 8px #36c2f6;\r\n  border-left: none;\r\n  left: 12px;\r\n  right: initial;\r\n}\r\n\r\n.rst__highlightBottomLeftCorner::after {\r\n  content: '';\r\n  position: absolute;\r\n  height: 0;\r\n  right: 0;\r\n  top: 100%;\r\n  margin-top: -12px;\r\n  border-top: 12px solid transparent;\r\n  border-bottom: 12px solid transparent;\r\n  border-left: 12px solid #36c2f6;\r\n}\r\n\r\n.rst__rtl.rst__highlightBottomLeftCorner::after {\r\n  left: 0;\r\n  right: initial;\r\n  border-right: 12px solid #36c2f6;\r\n  border-left: none;\r\n}\r\n";
styleInject(css_248z);

const defaultProps$1 = {
    swapFrom: undefined,
    swapDepth: undefined,
    swapLength: undefined,
    canDrop: false,
    draggedNode: undefined,
    rowDirection: 'ltr',
};
class TreeNodeComponent extends Component {
    nodeRef = createRef();
    render() {
        const props = { ...defaultProps$1, ...this.props };
        const { children, listIndex, swapFrom, swapLength, swapDepth, scaffoldBlockPxWidth, lowerSiblingCounts, connectDropTarget, isOver, draggedNode, canDrop, treeIndex, rowHeight, treeId: _treeId, // Delete from otherProps
        getPrevRow: _getPrevRow, // Delete from otherProps
        node: _node, // Delete from otherProps
        path: _path, // Delete from otherProps
        rowDirection, ...otherProps } = props;
        const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;
        // Construct the scaffold representing the structure of the tree
        const scaffoldBlockCount = lowerSiblingCounts.length;
        const scaffold = [];
        for (const [i, lowerSiblingCount] of lowerSiblingCounts.entries()) {
            let lineClass = '';
            if (lowerSiblingCount > 0) {
                // At this level in the tree, the nodes had sibling nodes further down
                if (listIndex === 0) {
                    // Top-left corner of the tree
                    // +-----+
                    // |     |
                    // |  +--+
                    // |  |  |
                    // +--+--+
                    lineClass = 'rst__lineHalfHorizontalRight rst__lineHalfVerticalBottom';
                }
                else if (i === scaffoldBlockCount - 1) {
                    // Last scaffold block in the row, right before the row content
                    // +--+--+
                    // |  |  |
                    // |  +--+
                    // |  |  |
                    // +--+--+
                    lineClass = 'rst__lineHalfHorizontalRight rst__lineFullVertical';
                }
                else {
                    // Simply connecting the line extending down to the next sibling on this level
                    // +--+--+
                    // |  |  |
                    // |  |  |
                    // |  |  |
                    // +--+--+
                    lineClass = 'rst__lineFullVertical';
                }
            }
            else if (listIndex === 0) {
                // Top-left corner of the tree, but has no siblings
                // +-----+
                // |     |
                // |  +--+
                // |     |
                // +-----+
                lineClass = 'rst__lineHalfHorizontalRight';
            }
            else if (i === scaffoldBlockCount - 1) {
                // The last or only node in this level of the tree
                // +--+--+
                // |  |  |
                // |  +--+
                // |     |
                // +-----+
                lineClass = 'rst__lineHalfVerticalTop rst__lineHalfHorizontalRight';
            }
            scaffold.push(React.createElement("div", { key: `pre_${1 + i}`, style: { width: scaffoldBlockPxWidth }, className: classnames('rst__lineBlock', lineClass, rowDirectionClass ?? '') }));
            if (treeIndex !== listIndex && i === swapDepth) {
                // This row has been shifted, and is at the depth of
                // the line pointing to the new destination
                let highlightLineClass = '';
                if (listIndex === swapFrom + swapLength - 1) {
                    // This block is on the bottom (target) line
                    // This block points at the target block (where the row will go when released)
                    highlightLineClass = 'rst__highlightBottomLeftCorner';
                }
                else if (treeIndex === swapFrom) {
                    // This block is on the top (source) line
                    highlightLineClass = 'rst__highlightTopLeftCorner';
                }
                else {
                    // This block is between the bottom and top
                    highlightLineClass = 'rst__highlightLineVertical';
                }
                const style = rowDirection === 'rtl'
                    ? {
                        width: scaffoldBlockPxWidth,
                        right: scaffoldBlockPxWidth * i,
                    }
                    : {
                        width: scaffoldBlockPxWidth,
                        left: scaffoldBlockPxWidth * i,
                    };
                scaffold.push(React.createElement("div", { key: i, style: style, className: classnames('rst__absoluteLineBlock', highlightLineClass, rowDirectionClass ?? '') }));
            }
        }
        const style = rowDirection === 'rtl'
            ? { right: scaffoldBlockPxWidth * scaffoldBlockCount }
            : { left: scaffoldBlockPxWidth * scaffoldBlockCount };
        let calculatedRowHeight = rowHeight;
        if (typeof rowHeight === 'function') {
            calculatedRowHeight = rowHeight(treeIndex, _node, _path);
        }
        return connectDropTarget(React.createElement("div", { ...otherProps, style: { height: `${calculatedRowHeight}px` }, className: classnames('rst__node', rowDirectionClass ?? ''), ref: this.nodeRef },
            scaffold,
            React.createElement("div", { className: "rst__nodeContent", style: style }, Children.map(children, (child) => cloneElement(child, {
                isOver,
                canDrop,
                draggedNode,
            })))));
    }
}

const defaultProps = {
    canDrop: false,
    draggedNode: undefined,
};
const TreePlaceholder = (props) => {
    props = { ...defaultProps, ...props };
    const { children, connectDropTarget, treeId, drop, ...otherProps } = props;
    return connectDropTarget(React.createElement("div", null, Children.map(children, (child) => cloneElement(child, {
        ...otherProps,
    }))));
};

// @ts-nocheck
let rafId = 0;
const nodeDragSourcePropInjection = (connect, monitor) => ({
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging(),
    didDrop: monitor.didDrop(),
});
const wrapSource = (el, startDrag, endDrag, dndType) => {
    const nodeDragSource = {
        beginDrag: (props) => {
            startDrag(props);
            return {
                node: props.node,
                parentNode: props.parentNode,
                path: props.path,
                treeIndex: props.treeIndex,
                treeId: props.treeId,
            };
        },
        endDrag: (props, monitor) => {
            endDrag(monitor.getDropResult());
        },
        isDragging: (props, monitor) => {
            const dropTargetNode = monitor.getItem().node;
            const draggedNode = props.node;
            return draggedNode === dropTargetNode;
        },
    };
    return DragSource(dndType, nodeDragSource, nodeDragSourcePropInjection)(el);
};
const propInjection = (connect, monitor) => {
    const dragged = monitor.getItem();
    return {
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
        draggedNode: dragged ? dragged.node : undefined,
    };
};
const wrapPlaceholder = (el, treeId, drop, dndType) => {
    const placeholderDropTarget = {
        drop: (dropTargetProps, monitor) => {
            const { node, path, treeIndex } = monitor.getItem();
            const result = {
                node,
                path,
                treeIndex,
                treeId,
                minimumTreeIndex: 0,
                depth: 0,
            };
            drop(result);
            return result;
        },
    };
    return DropTarget(dndType, placeholderDropTarget, propInjection)(el);
};
const getTargetDepth = (dropTargetProps, monitor, component, canNodeHaveChildren, treeId, maxDepth) => {
    let dropTargetDepth = 0;
    const rowAbove = dropTargetProps.getPrevRow();
    if (rowAbove) {
        const { node } = rowAbove;
        let { path } = rowAbove;
        const aboveNodeCannotHaveChildren = !canNodeHaveChildren(node);
        if (aboveNodeCannotHaveChildren) {
            path = path.slice(0, -1);
        }
        // Limit the length of the path to the deepest possible
        dropTargetDepth = Math.min(path.length, dropTargetProps.path.length);
    }
    let blocksOffset;
    let dragSourceInitialDepth = (monitor.getItem().path || []).length;
    // When adding node from external source
    if (monitor.getItem().treeId === treeId) {
        // handle row direction support
        const direction = dropTargetProps.rowDirection === 'rtl' ? -1 : 1;
        blocksOffset = Math.round((direction * monitor.getDifferenceFromInitialOffset().x) /
            dropTargetProps.scaffoldBlockPxWidth);
    }
    else {
        // Ignore the tree depth of the source, if it had any to begin with
        dragSourceInitialDepth = 0;
        if (component) {
            const relativePosition = component.node.getBoundingClientRect();
            const leftShift = monitor.getSourceClientOffset().x - relativePosition.left;
            blocksOffset = Math.round(leftShift / dropTargetProps.scaffoldBlockPxWidth);
        }
        else {
            blocksOffset = dropTargetProps.path.length;
        }
    }
    let targetDepth = Math.min(dropTargetDepth, Math.max(0, dragSourceInitialDepth + blocksOffset - 1));
    // If a maxDepth is defined, constrain the target depth
    if (maxDepth !== undefined) {
        const draggedNode = monitor.getItem().node;
        const draggedChildDepth = getDepth(draggedNode);
        targetDepth = Math.max(0, Math.min(targetDepth, maxDepth - draggedChildDepth - 1));
    }
    return targetDepth;
};
const canDrop = (dropTargetProps, monitor, canNodeHaveChildren, treeId, maxDepth, treeRefcanDrop) => {
    if (!monitor.isOver()) {
        return false;
    }
    const rowAbove = dropTargetProps.getPrevRow();
    const abovePath = rowAbove ? rowAbove.path : [];
    const aboveNode = rowAbove ? rowAbove.node : {};
    const targetDepth = getTargetDepth(dropTargetProps, monitor, undefined, canNodeHaveChildren, treeId, maxDepth);
    // Cannot drop if we're adding to the children of the row above and
    //  the row above is a function
    if (targetDepth >= abovePath.length &&
        typeof aboveNode.children === 'function') {
        return false;
    }
    if (typeof treeRefcanDrop === 'function') {
        const { node } = monitor.getItem();
        return treeRefcanDrop({
            node,
            prevPath: monitor.getItem().path,
            prevParent: monitor.getItem().parentNode,
            prevTreeIndex: monitor.getItem().treeIndex, // Equals -1 when dragged from external tree
            nextPath: dropTargetProps.children.props.path,
            nextParent: dropTargetProps.children.props.parentNode,
            nextTreeIndex: dropTargetProps.children.props.treeIndex,
        });
    }
    return true;
};
const wrapTarget = (el, canNodeHaveChildren, treeId, maxDepth, treeRefcanDrop, drop, dragHover, dndType) => {
    const nodeDropTarget = {
        drop: (dropTargetProps, monitor, component) => {
            const result = {
                node: monitor.getItem().node,
                path: monitor.getItem().path,
                treeIndex: monitor.getItem().treeIndex,
                treeId,
                minimumTreeIndex: dropTargetProps.treeIndex,
                depth: getTargetDepth(dropTargetProps, monitor, component, canNodeHaveChildren, treeId, maxDepth),
            };
            drop(result);
            return result;
        },
        hover: (dropTargetProps, monitor, component) => {
            const targetDepth = getTargetDepth(dropTargetProps, monitor, component, canNodeHaveChildren, treeId, maxDepth);
            const draggedNode = monitor.getItem().node;
            const needsRedraw = 
            // Redraw if hovered above different nodes
            dropTargetProps.node !== draggedNode ||
                // Or hovered above the same node but at a different depth
                targetDepth !== dropTargetProps.path.length - 1;
            if (!needsRedraw) {
                return;
            }
            // throttle `dragHover` work to available animation frames
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const item = monitor.getItem();
                // skip if drag already ended before the animation frame
                if (!item || !monitor.isOver()) {
                    return;
                }
                dragHover({
                    node: draggedNode,
                    path: item.path,
                    minimumTreeIndex: dropTargetProps.listIndex,
                    depth: targetDepth,
                });
            });
        },
        canDrop: (dropTargetProps, monitor) => canDrop(dropTargetProps, monitor, canNodeHaveChildren, treeId, maxDepth, treeRefcanDrop),
    };
    return DropTarget(dndType, nodeDropTarget, propInjection)(el);
};

const slideRows = (rows, fromIndex, toIndex, count = 1) => {
    const rowsWithoutMoved = [
        ...rows.slice(0, fromIndex),
        ...rows.slice(fromIndex + count),
    ];
    return [
        ...rowsWithoutMoved.slice(0, toIndex),
        ...rows.slice(fromIndex, fromIndex + count),
        ...rowsWithoutMoved.slice(toIndex),
    ];
};

const memoize = (f) => {
    let savedArgsArray = [];
    let savedKeysArray = [];
    let savedResult;
    return (args) => {
        const keysArray = Object.keys(args).sort();
        const argsArray = keysArray.map((key) => args[key]);
        // If the arguments for the last insert operation are different than this time,
        // recalculate the result
        if (argsArray.length !== savedArgsArray.length ||
            argsArray.some((arg, index) => arg !== savedArgsArray[index]) ||
            keysArray.some((key, index) => key !== savedKeysArray[index])) {
            savedArgsArray = argsArray;
            savedKeysArray = keysArray;
            savedResult = f(args);
        }
        return savedResult;
    };
};
const memoizedInsertNode = memoize(insertNode);
const memoizedGetFlatDataFromTree = memoize(getFlatDataFromTree);
const memoizedGetDescendantCount = memoize(getDescendantCount);

// @ts-nocheck
let treeIdCounter = 1;
const mergeTheme = (props) => {
    const merged = {
        ...props,
        style: { ...props.theme.style, ...props.style },
        innerStyle: { ...props.theme.innerStyle, ...props.innerStyle },
    };
    const overridableDefaults = {
        nodeContentRenderer: NodeRendererDefault,
        placeholderRenderer: PlaceholderRendererDefault,
        scaffoldBlockPxWidth: 44,
        slideRegionSize: 100,
        rowHeight: 62,
        treeNodeRenderer: TreeNodeComponent,
    };
    for (const propKey of Object.keys(overridableDefaults)) {
        // If prop has been specified, do not change it
        // If prop is specified in theme, use the theme setting
        // If all else fails, fall back to the default
        if (props[propKey] === undefined) {
            merged[propKey] =
                props.theme[propKey] === undefined
                    ? overridableDefaults[propKey]
                    : props.theme[propKey];
        }
    }
    return merged;
};
class ReactSortableTree extends Component {
    // returns the new state after search
    static search(props, state, seekIndex, expand, singleSearch) {
        const { onChange, getNodeKey, searchFinishCallback, searchQuery, searchMethod, searchFocusOffset, onlyExpandSearchedNodes, } = props;
        const { instanceProps } = state;
        // Skip search if no conditions are specified
        if (!searchQuery && !searchMethod) {
            if (searchFinishCallback) {
                searchFinishCallback([]);
            }
            return { searchMatches: [] };
        }
        const newState = { instanceProps: {} };
        // if onlyExpandSearchedNodes collapse the tree and search
        const { treeData: expandedTreeData, matches: searchMatches } = find({
            getNodeKey,
            treeData: onlyExpandSearchedNodes
                ? toggleExpandedForAll({
                    treeData: instanceProps.treeData,
                    expanded: false,
                })
                : instanceProps.treeData,
            searchQuery,
            searchMethod: searchMethod || defaultSearchMethod,
            searchFocusOffset,
            expandAllMatchPaths: expand && !singleSearch,
            expandFocusMatchPaths: !!expand,
        });
        // Update the tree with data leaving all paths leading to matching nodes open
        if (expand) {
            newState.instanceProps.ignoreOneTreeUpdate = true; // Prevents infinite loop
            onChange(expandedTreeData);
        }
        if (searchFinishCallback) {
            searchFinishCallback(searchMatches);
        }
        let searchFocusTreeIndex;
        if (seekIndex &&
            searchFocusOffset !== undefined &&
            searchFocusOffset < searchMatches.length) {
            searchFocusTreeIndex = searchMatches[searchFocusOffset].treeIndex;
        }
        newState.searchMatches = searchMatches;
        newState.searchFocusTreeIndex = searchFocusTreeIndex;
        return newState;
    }
    // Load any children in the tree that are given by a function
    // calls the onChange callback on the new treeData
    static loadLazyChildren(props, state) {
        const { instanceProps } = state;
        walk({
            treeData: instanceProps.treeData,
            getNodeKey: props.getNodeKey,
            callback: ({ node, path, lowerSiblingCounts, treeIndex }) => {
                // If the node has children defined by a function, and is either expanded
                //  or set to load even before expansion, run the function.
                if (node.children &&
                    typeof node.children === 'function' &&
                    (node.expanded || props.loadCollapsedLazyChildren)) {
                    // Call the children fetching function
                    node.children({
                        node,
                        path,
                        lowerSiblingCounts,
                        treeIndex,
                        // Provide a helper to append the new data when it is received
                        done: (childrenArray) => props.onChange(changeNodeAtPath({
                            treeData: instanceProps.treeData,
                            path,
                            newNode: ({ node: oldNode }) => 
                            // Only replace the old node if it's the one we set off to find children
                            //  for in the first place
                            oldNode === node
                                ? {
                                    ...oldNode,
                                    children: childrenArray,
                                }
                                : oldNode,
                            getNodeKey: props.getNodeKey,
                        })),
                    });
                }
            },
        });
    }
    constructor(props) {
        super(props);
        this.listRef = props.virtuaRef || React.createRef();
        const { dndType, nodeContentRenderer, treeNodeRenderer, slideRegionSize } = mergeTheme(props);
        // Wrapping classes for use with react-dnd
        this.treeId = `rst__${treeIdCounter}`;
        treeIdCounter += 1;
        this.dndType = dndType || this.treeId;
        this.nodeContentRenderer = wrapSource(nodeContentRenderer, this.startDrag, this.endDrag, this.dndType);
        this.treePlaceholderRenderer = wrapPlaceholder(TreePlaceholder, this.treeId, this.drop, this.dndType);
        this.state = {
            draggingTreeData: undefined,
            draggedNode: undefined,
            draggedMinimumTreeIndex: undefined,
            draggedDepth: undefined,
            searchMatches: [],
            searchFocusTreeIndex: undefined,
            dragging: false,
            // props that need to be used in gDSFP or static functions will be stored here
            instanceProps: {
                treeData: [],
                ignoreOneTreeUpdate: false,
                searchQuery: undefined,
                searchFocusOffset: undefined,
            },
        };
        this.treeNodeRenderer = wrapTarget(treeNodeRenderer, this.canNodeHaveChildren, this.treeId, this.props.maxDepth, this.props.canDrop, this.drop, this.dragHover, this.dndType);
        this.toggleChildrenVisibility = this.toggleChildrenVisibility.bind(this);
        this.moveNode = this.moveNode.bind(this);
        this.startDrag = this.startDrag.bind(this);
        this.dragHover = this.dragHover.bind(this);
        this.endDrag = this.endDrag.bind(this);
        this.drop = this.drop.bind(this);
        this.handleDndMonitorChange = this.handleDndMonitorChange.bind(this);
    }
    componentDidMount() {
        ReactSortableTree.loadLazyChildren(this.props, this.state);
        const stateUpdate = ReactSortableTree.search(this.props, this.state, true, true, false);
        this.setState(stateUpdate);
        // Hook into react-dnd state changes to detect when the drag ends
        // TODO: This is very brittle, so it needs to be replaced if react-dnd
        // offers a more official way to detect when a drag ends
        this.clearMonitorSubscription = this.props.dragDropManager
            .getMonitor()
            .subscribeToStateChange(this.handleDndMonitorChange);
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        const { instanceProps } = prevState;
        const newState = {};
        const newInstanceProps = { ...instanceProps };
        const isTreeDataEqual = isEqual(instanceProps.treeData, nextProps.treeData);
        // make sure we have the most recent version of treeData
        newInstanceProps.treeData = nextProps.treeData;
        if (!isTreeDataEqual) {
            if (instanceProps.ignoreOneTreeUpdate) {
                newInstanceProps.ignoreOneTreeUpdate = false;
            }
            else {
                newState.searchFocusTreeIndex = undefined;
                ReactSortableTree.loadLazyChildren(nextProps, prevState);
                Object.assign(newState, ReactSortableTree.search(nextProps, prevState, false, false, false));
            }
            newState.draggingTreeData = undefined;
            newState.draggedNode = undefined;
            newState.draggedMinimumTreeIndex = undefined;
            newState.draggedDepth = undefined;
            newState.dragging = false;
        }
        else if (!isEqual(instanceProps.searchQuery, nextProps.searchQuery)) {
            Object.assign(newState, ReactSortableTree.search(nextProps, prevState, true, true, false));
        }
        else if (instanceProps.searchFocusOffset !== nextProps.searchFocusOffset) {
            Object.assign(newState, ReactSortableTree.search(nextProps, prevState, true, true, true));
        }
        newInstanceProps.searchQuery = nextProps.searchQuery;
        newInstanceProps.searchFocusOffset = nextProps.searchFocusOffset;
        newState.instanceProps = { ...newInstanceProps, ...newState.instanceProps };
        return newState;
    }
    // listen to dragging
    componentDidUpdate(prevProps, prevState) {
        // if it is not the same then call the onDragStateChanged
        if (this.state.dragging !== prevState.dragging &&
            this.props.onDragStateChanged) {
            this.props.onDragStateChanged({
                isDragging: this.state.dragging,
                draggedNode: this.state.draggedNode,
            });
        }
    }
    componentWillUnmount() {
        this.clearMonitorSubscription();
    }
    handleDndMonitorChange() {
        const monitor = this.props.dragDropManager.getMonitor();
        // If the drag ends and the tree is still in a mid-drag state,
        // it means that the drag was canceled or the dragSource dropped
        // elsewhere, and we should reset the state of this tree
        if (!monitor.isDragging() && this.state.draggingTreeData) {
            setTimeout(() => {
                this.endDrag();
            });
        }
    }
    getRows(treeData) {
        return memoizedGetFlatDataFromTree({
            ignoreCollapsed: true,
            getNodeKey: this.props.getNodeKey,
            treeData,
        });
    }
    startDrag = ({ path }) => {
        this.setState((prevState) => {
            const { treeData: draggingTreeData, node: draggedNode, treeIndex: draggedMinimumTreeIndex, } = removeNode({
                treeData: prevState.instanceProps.treeData,
                path,
                getNodeKey: this.props.getNodeKey,
            });
            return {
                draggingTreeData,
                draggedNode,
                draggedDepth: path.length - 1,
                draggedMinimumTreeIndex,
                dragging: true,
            };
        });
    };
    dragHover = ({ node: draggedNode, depth: draggedDepth, minimumTreeIndex: draggedMinimumTreeIndex, }) => {
        // Ignore this hover if it is at the same position as the last hover
        if (this.state.draggedDepth === draggedDepth &&
            this.state.draggedMinimumTreeIndex === draggedMinimumTreeIndex) {
            return;
        }
        this.setState(({ draggingTreeData, instanceProps }) => {
            // Fall back to the tree data if something is being dragged in from
            //  an external element
            const newDraggingTreeData = draggingTreeData || instanceProps.treeData;
            const addedResult = memoizedInsertNode({
                treeData: newDraggingTreeData,
                newNode: draggedNode,
                depth: draggedDepth,
                minimumTreeIndex: draggedMinimumTreeIndex,
                expandParent: true,
                getNodeKey: this.props.getNodeKey,
            });
            const rows = this.getRows(addedResult.treeData);
            const expandedParentPath = rows[addedResult.treeIndex].path;
            return {
                draggedNode,
                draggedDepth,
                draggedMinimumTreeIndex,
                draggingTreeData: changeNodeAtPath({
                    treeData: newDraggingTreeData,
                    path: expandedParentPath.slice(0, -1),
                    newNode: ({ node }) => ({ ...node, expanded: true }),
                    getNodeKey: this.props.getNodeKey,
                }),
                // reset the scroll focus so it doesn't jump back
                // to a search result while dragging
                searchFocusTreeIndex: undefined,
                dragging: true,
            };
        });
    };
    endDrag = (dropResult) => {
        const { instanceProps } = this.state;
        // Drop was cancelled
        if (!dropResult) {
            this.setState({
                draggingTreeData: undefined,
                draggedNode: undefined,
                draggedMinimumTreeIndex: undefined,
                draggedDepth: undefined,
                dragging: false,
            });
        }
        else if (dropResult.treeId !== this.treeId) {
            // The node was dropped in an external drop target or tree
            const { node, path, treeIndex } = dropResult;
            let shouldCopy = this.props.shouldCopyOnOutsideDrop;
            if (typeof shouldCopy === 'function') {
                shouldCopy = shouldCopy({
                    node,
                    prevTreeIndex: treeIndex,
                    prevPath: path,
                });
            }
            let treeData = this.state.draggingTreeData || instanceProps.treeData;
            // If copying is enabled, a drop outside leaves behind a copy in the
            //  source tree
            if (shouldCopy) {
                treeData = changeNodeAtPath({
                    treeData: instanceProps.treeData, // use treeData unaltered by the drag operation
                    path,
                    newNode: ({ node: copyNode }) => ({ ...copyNode }), // create a shallow copy of the node
                    getNodeKey: this.props.getNodeKey,
                });
            }
            this.props.onChange(treeData);
            this.props.onMoveNode({
                treeData,
                node,
                treeIndex: undefined,
                path: undefined,
                nextPath: undefined,
                nextTreeIndex: undefined,
                prevPath: path,
                prevTreeIndex: treeIndex,
            });
        }
    };
    drop = (dropResult) => {
        this.moveNode(dropResult);
    };
    canNodeHaveChildren = (node) => {
        const { canNodeHaveChildren } = this.props;
        if (canNodeHaveChildren) {
            return canNodeHaveChildren(node);
        }
        return true;
    };
    toggleChildrenVisibility({ node: targetNode, path }) {
        const { instanceProps } = this.state;
        const treeData = changeNodeAtPath({
            treeData: instanceProps.treeData,
            path,
            newNode: ({ node }) => ({ ...node, expanded: !node.expanded }),
            getNodeKey: this.props.getNodeKey,
        });
        this.props.onChange(treeData);
        this.props.onVisibilityToggle({
            treeData,
            node: targetNode,
            expanded: !targetNode.expanded,
            path,
        });
    }
    moveNode({ node, path: prevPath, treeIndex: prevTreeIndex, depth, minimumTreeIndex, }) {
        const { treeData, treeIndex, path, parentNode: nextParentNode, } = insertNode({
            treeData: this.state.draggingTreeData,
            newNode: node,
            depth,
            minimumTreeIndex,
            expandParent: true,
            getNodeKey: this.props.getNodeKey,
        });
        this.props.onChange(treeData);
        this.props.onMoveNode({
            treeData,
            node,
            treeIndex,
            path,
            nextPath: path,
            nextTreeIndex: treeIndex,
            prevPath,
            prevTreeIndex,
            nextParentNode,
        });
    }
    renderRow(row, { listIndex, style, getPrevRow, matchKeys, swapFrom, swapDepth, swapLength }) {
        const { node, parentNode, path, lowerSiblingCounts, treeIndex } = row;
        const { canDrag, generateNodeProps, scaffoldBlockPxWidth, searchFocusOffset, rowDirection, rowHeight, } = mergeTheme(this.props);
        const TreeNodeRenderer = this.treeNodeRenderer;
        const NodeContentRenderer = this.nodeContentRenderer;
        const nodeKey = path.at(-1);
        const isSearchMatch = nodeKey in matchKeys;
        const isSearchFocus = isSearchMatch && matchKeys[nodeKey] === searchFocusOffset;
        const callbackParams = {
            node,
            parentNode,
            path,
            lowerSiblingCounts,
            treeIndex,
            isSearchMatch,
            isSearchFocus,
        };
        const nodeProps = generateNodeProps ? generateNodeProps(callbackParams) : {};
        const rowCanDrag = typeof canDrag === 'function' ? canDrag(callbackParams) : canDrag;
        const sharedProps = {
            treeIndex,
            scaffoldBlockPxWidth,
            node,
            path,
            treeId: this.treeId,
            rowDirection,
        };
        return (React.createElement(TreeNodeRenderer, { style: style, rowHeight: rowHeight, key: nodeKey, listIndex: listIndex, getPrevRow: getPrevRow, lowerSiblingCounts: lowerSiblingCounts, swapFrom: swapFrom, swapLength: swapLength, swapDepth: swapDepth, ...sharedProps },
            React.createElement(NodeContentRenderer, { parentNode: parentNode, isSearchMatch: isSearchMatch, isSearchFocus: isSearchFocus, canDrag: rowCanDrag, toggleChildrenVisibility: this.toggleChildrenVisibility, ...sharedProps, ...nodeProps })));
    }
    render() {
        const { dragDropManager, style, className, innerStyle, placeholderRenderer, getNodeKey, rowDirection, } = mergeTheme(this.props);
        const { searchMatches, searchFocusTreeIndex, draggedNode, draggedDepth, draggedMinimumTreeIndex, draggingTreeData, instanceProps, } = this.state;
        const treeData = draggingTreeData || instanceProps.treeData;
        const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;
        let rows;
        let swapFrom;
        let swapLength;
        if (draggedNode && draggedMinimumTreeIndex !== undefined) {
            const addedResult = memoizedInsertNode({
                treeData,
                newNode: draggedNode,
                depth: draggedDepth,
                minimumTreeIndex: draggedMinimumTreeIndex,
                expandParent: true,
                getNodeKey,
            });
            const swapTo = draggedMinimumTreeIndex;
            swapFrom = addedResult.treeIndex;
            swapLength = 1 + memoizedGetDescendantCount({ node: draggedNode });
            rows = slideRows(this.getRows(addedResult.treeData), swapFrom, swapTo, swapLength);
        }
        else {
            rows = this.getRows(treeData);
        }
        // Get indices for rows that match the search conditions
        const matchKeys = {};
        for (const [i, { path }] of searchMatches.entries()) {
            matchKeys[path.at(-1)] = i;
        }
        // Seek to the focused search result if there is one specified
        if (searchFocusTreeIndex !== undefined) {
            this.listRef?.current?.scrollToIndex(searchFocusTreeIndex, {
                smooth: true,
                align: 'center',
            });
        }
        let containerStyle = style;
        let list;
        if (rows.length === 0) {
            const Placeholder = this.treePlaceholderRenderer;
            const PlaceholderContent = placeholderRenderer;
            list = (React.createElement(Placeholder, { treeId: this.treeId, drop: this.drop },
                React.createElement(PlaceholderContent, null)));
        }
        else {
            containerStyle = { height: '100%', ...containerStyle };
            list = (React.createElement(VList, { id: "vlist", ref: this.listRef, dragDropManager: dragDropManager, style: innerStyle, count: rows.length }, (index) => {
                const item = rows[index];
                return this.renderRow(item, {
                    listIndex: index,
                    getPrevRow: () => rows[index - 1] || undefined,
                    matchKeys,
                    swapFrom,
                    swapDepth: draggedDepth,
                    swapLength,
                });
            }));
        }
        return (React.createElement("div", { className: classnames('rst__tree', className, rowDirectionClass), style: containerStyle }, list));
    }
}
ReactSortableTree.defaultProps = {
    canDrag: true,
    canDrop: undefined,
    canNodeHaveChildren: () => true,
    className: '',
    dndType: undefined,
    generateNodeProps: undefined,
    getNodeKey: defaultGetNodeKey,
    innerStyle: {},
    maxDepth: undefined,
    treeNodeRenderer: undefined,
    nodeContentRenderer: undefined,
    onMoveNode: () => { },
    onVisibilityToggle: () => { },
    placeholderRenderer: undefined,
    scaffoldBlockPxWidth: undefined,
    searchFinishCallback: undefined,
    searchFocusOffset: undefined,
    searchMethod: undefined,
    searchQuery: undefined,
    shouldCopyOnOutsideDrop: false,
    slideRegionSize: undefined,
    style: {},
    theme: {},
    onDragStateChanged: () => { },
    onlyExpandSearchedNodes: false,
    rowDirection: 'ltr',
    debugMode: false,
    overscan: 0,
    virtuaRef: undefined,
};
const SortableTreeWithoutDndContext = (props) => {
    return (React.createElement(DndContext.Consumer, null, ({ dragDropManager }) => dragDropManager === undefined ? undefined : (React.createElement(ReactSortableTree, { ...props, dragDropManager: dragDropManager }))));
};
const SortableTree = (props) => {
    return (React.createElement(DndProvider, { debugMode: props.debugMode, backend: HTML5Backend },
        React.createElement(SortableTreeWithoutDndContext, { ...props })));
};

export { SortableTree, SortableTreeWithoutDndContext, addNodeUnderParent, changeNodeAtPath, defaultGetNodeKey, defaultSearchMethod, find, getDepth, getDescendantCount, getFlatDataFromTree, getNodeAtPath, getTreeFromFlatData, getVisibleNodeCount, getVisibleNodeInfoAtIndex, insertNode, isDescendant, map, removeNode, removeNodeAtPath, toggleExpandedForAll, walk };
//# sourceMappingURL=index.esm.js.map
