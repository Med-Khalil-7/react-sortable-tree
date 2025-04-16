import React, { ReactNode } from 'react';
import { VListHandle } from 'virtua';

interface GetTreeItemChildren {
    done: (children: TreeItem[]) => void;
    node: TreeItem;
    path: number[];
    lowerSiblingCounts: number[];
    treeIndex: number;
}
type GetTreeItemChildrenFn = (data: GetTreeItemChildren) => void;
type GetNodeKeyFunction = (data: TreeIndex & TreeNode) => string | number;
interface TreeItem {
    title?: ReactNode | undefined;
    subtitle?: ReactNode | undefined;
    expanded?: boolean | undefined;
    children?: TreeItem[] | GetTreeItemChildrenFn | undefined;
    [x: string]: any;
}
interface TreeNode {
    node: TreeItem;
}
interface TreePath {
    path: number[];
}
interface TreeIndex {
    treeIndex: number;
}
interface FullTree {
    treeData: TreeItem[] | undefined;
}
interface NodeData extends TreeNode, TreePath, TreeIndex {
}
interface SearchData extends NodeData {
    searchQuery: string;
}
declare const defaultGetNodeKey: ({ treeIndex }: TreeIndex) => number;
declare const defaultSearchMethod: ({ node, path, treeIndex, searchQuery, }: SearchData) => boolean;

type WalkAndMapFunctionParameters = FullTree & {
    getNodeKey: GetNodeKeyFunction;
    callback: Function;
    ignoreCollapsed?: boolean | undefined;
};
interface FlatDataItem extends TreeNode, TreePath {
    lowerSiblingCounts: number[];
    parentNode: TreeItem;
}
declare const getDescendantCount: ({ node, ignoreCollapsed, }: TreeNode & {
    ignoreCollapsed?: boolean | undefined;
}) => number;
declare const getVisibleNodeCount: ({ treeData }: FullTree) => number;
declare const getVisibleNodeInfoAtIndex: ({ treeData, index: targetIndex, getNodeKey, }: FullTree & {
    index: number;
    getNodeKey: GetNodeKeyFunction;
}) => (TreeNode & TreePath & {
    lowerSiblingCounts: number[];
}) | null;
declare const walk: ({ treeData, getNodeKey, callback, ignoreCollapsed, }: WalkAndMapFunctionParameters) => void;
declare const map: ({ treeData, getNodeKey, callback, ignoreCollapsed, }: WalkAndMapFunctionParameters) => TreeItem[];
declare const toggleExpandedForAll: ({ treeData, expanded, }: FullTree & {
    expanded?: boolean | undefined;
}) => TreeItem[];
declare const changeNodeAtPath: ({ treeData, path, newNode, getNodeKey, ignoreCollapsed, }: FullTree & TreePath & {
    newNode: Function | any;
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
}) => TreeItem[];
declare const removeNodeAtPath: ({ treeData, path, getNodeKey, ignoreCollapsed, }: FullTree & TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
}) => TreeItem[];
declare const removeNode: ({ treeData, path, getNodeKey, ignoreCollapsed, }: FullTree & TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
}) => (FullTree & TreeNode & TreeIndex) | undefined;
declare const getNodeAtPath: ({ treeData, path, getNodeKey, ignoreCollapsed, }: FullTree & TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
}) => (TreeNode & TreeIndex) | null;
declare const addNodeUnderParent: ({ treeData, newNode, parentKey, getNodeKey, ignoreCollapsed, expandParent, addAsFirstChild, }: FullTree & {
    newNode: TreeItem;
    parentKey?: number | string | undefined | null;
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
    expandParent?: boolean | undefined;
    addAsFirstChild?: boolean | undefined;
}) => FullTree & TreeIndex;
declare const insertNode: ({ treeData, depth: targetDepth, minimumTreeIndex, newNode, getNodeKey, ignoreCollapsed, expandParent, }: FullTree & {
    depth: number;
    newNode: TreeItem;
    minimumTreeIndex: number;
    ignoreCollapsed?: boolean | undefined;
    expandParent?: boolean | undefined;
    getNodeKey: GetNodeKeyFunction;
}) => FullTree & TreeIndex & TreePath & {
    parentNode: TreeItem | null;
};
declare const getFlatDataFromTree: ({ treeData, getNodeKey, ignoreCollapsed, }: FullTree & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
}) => FlatDataItem[];
declare const getTreeFromFlatData: ({ flatData, getKey, getParentKey, rootKey, }: {
    flatData: any;
    getKey: (node: any) => string;
    getParentKey: (node: any) => string;
    rootKey: string | null;
}) => any;
declare const isDescendant: (older: TreeItem, younger: TreeItem) => boolean;
declare const getDepth: (node: TreeItem, depth?: number) => number;
declare const find: ({ getNodeKey, treeData, searchQuery, searchMethod, searchFocusOffset, expandAllMatchPaths, expandFocusMatchPaths, }: FullTree & {
    getNodeKey: GetNodeKeyFunction;
    searchQuery?: string | number | undefined;
    searchMethod: (data: SearchData) => boolean;
    searchFocusOffset?: number | undefined;
    expandAllMatchPaths?: boolean | undefined;
    expandFocusMatchPaths?: boolean | undefined;
}) => {
    matches: NodeData[];
} & FullTree;

type SearchParams = {
    node: any;
    path: number[];
    treeIndex: number;
    searchQuery: string;
};
type SearchFinishCallbackParams = {
    node: any;
    path: number[];
    treeIndex: number;
}[];
type GenerateNodePropsParams = {
    node: any;
    path: number[];
    treeIndex: number;
    lowerSiblingCounts: number[];
    isSearchMatch: boolean;
    isSearchFocus: boolean;
};
type ShouldCopyOnOutsideDropParams = {
    node: any;
    prevPath: number[];
    prevTreeIndex: number;
};
type OnMoveNodeParams = {
    treeData: any[];
    node: any;
    nextParentNode: any;
    prevPath: number[];
    prevTreeIndex: number;
    nextPath: number[];
    nextTreeIndex: number;
};
type CanDropParams = {
    node: any;
    prevPath: number[];
    prevParent: any;
    prevTreeIndex: number;
    nextPath: number[];
    nextParent: any;
    nextTreeIndex: number;
};
type OnVisibilityToggleParams = {
    treeData: any[];
    node: any;
    expanded: boolean;
    path: number[];
};
type OnDragStateChangedParams = {
    isDragging: boolean;
    draggedNode: any;
};
type ReactSortableTreeProps = {
    dragDropManager?: {
        getMonitor: () => unknown;
    };
    treeData: any[];
    style?: any;
    className?: string;
    virtuaRef?: React.Ref<VListHandle>;
    innerStyle?: any;
    slideRegionSize?: number;
    scaffoldBlockPxWidth?: number;
    maxDepth?: number;
    searchMethod?: (params: SearchParams) => boolean;
    searchQuery?: string;
    searchFocusOffset?: number;
    searchFinishCallback?: (params: SearchFinishCallbackParams) => void;
    generateNodeProps?: (params: GenerateNodePropsParams) => any;
    treeNodeRenderer?: any;
    nodeContentRenderer?: any;
    placeholderRenderer?: any;
    theme?: {
        style: any;
        innerStyle: any;
        scaffoldBlockPxWidth: number;
        slideRegionSize: number;
        treeNodeRenderer: any;
        nodeContentRenderer: any;
        placeholderRenderer: any;
    };
    rowHeight?: number | ((treeIndex: number, node: any, path: any[]) => number);
    getNodeKey?: (node: any) => string;
    onChange: (treeData: any) => void;
    onMoveNode?: (params: OnMoveNodeParams) => void;
    canDrag?: (params: GenerateNodePropsParams) => boolean;
    canDrop?: (params: CanDropParams) => boolean;
    canNodeHaveChildren?: (node: any) => boolean;
    shouldCopyOnOutsideDrop?: ((params: ShouldCopyOnOutsideDropParams) => boolean) | boolean;
    onVisibilityToggle?: (params: OnVisibilityToggleParams) => void;
    dndType?: string;
    onDragStateChanged?: (params: OnDragStateChangedParams) => void;
    onlyExpandSearchedNodes?: boolean;
    rowDirection?: string;
    debugMode?: boolean;
    overscan?: number | {
        main: number;
        reverse: number;
    };
};
declare const SortableTreeWithoutDndContext: (props: ReactSortableTreeProps) => React.JSX.Element;
declare const SortableTree: (props: ReactSortableTreeProps) => React.JSX.Element;

export { type FlatDataItem, type FullTree, type GetNodeKeyFunction, type GetTreeItemChildren, type GetTreeItemChildrenFn, type NodeData, type SearchData, SortableTree, SortableTreeWithoutDndContext, type TreeIndex, type TreeItem, type TreeNode, type TreePath, type WalkAndMapFunctionParameters, addNodeUnderParent, changeNodeAtPath, defaultGetNodeKey, defaultSearchMethod, find, getDepth, getDescendantCount, getFlatDataFromTree, getNodeAtPath, getTreeFromFlatData, getVisibleNodeCount, getVisibleNodeInfoAtIndex, insertNode, isDescendant, map, removeNode, removeNodeAtPath, toggleExpandedForAll, walk };
