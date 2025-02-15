/*
 * Tencent is pleased to support the open source community by making
 * 科技内在设计（T-inside） available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 科技内在设计（T-inside） is licensed under the MIT License.
 *
 * License for 科技内在设计（T-inside）:
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
*/

/**
 * @file table-layout
 *
 * Copyright © 2020-2021 T-inside Design. All Rights Reserved. T-inside 版权所有
 */

import Vue from 'vue'
import scrollbarWidth from '@/utils/scrollbar-width'
import { debounce } from 'throttle-debounce'
import { isShallowEqual } from './util'

class TableLayout {
    constructor (options) {
        this.observers = []
        this.table = null
        this.store = null
        this.columns = null
        this.fit = true
        this.showHeader = true

        this.height = null
        this.scrollX = false
        this.scrollY = false
        this.bodyWidth = null
        this.fixedWidth = null
        this.rightFixedWidth = null
        this.tableHeight = null
        this.headerHeight = 44 // Table Header Height
        this.appendHeight = 0 // Append Slot Height
        this.footerHeight = 44 // Table Footer Height
        this.paginationHeight = 0 // Table Pagination Height
        this.viewportHeight = null // Table Height - Scroll Bar Height
        this.bodyHeight = null // Table Height - Table Header Height
        this.fixedBodyHeight = null // Table Height - Table Header Height - Scroll Bar Height
        this.gutterWidth = options.table.virtualRender ? 0 : scrollbarWidth()
        this.rowsHeight = {}
        this.debouncedSyncRowHeight = debounce(1000 / 60, this.syncRowHeight)

        for (const name in options) {
            if (options.hasOwnProperty(name)) {
                this[name] = options[name]
            }
        }

        if (!this.table) {
            throw new Error('table is required for Table Layout')
        }
        if (!this.store) {
            throw new Error('store is required for Table Layout')
        }
    }

    updateScrollY () {
        const height = this.height
        if (typeof height !== 'string' && typeof height !== 'number') return
        const bodyWrapper = this.table.bodyWrapper
        if (this.table.$el && bodyWrapper) {
            const body = bodyWrapper.querySelector('.bk-table-body')
            this.scrollY = body.offsetHeight > this.bodyHeight
        }
    }

    setHeight (value, prop = 'height') {
        const el = this.table.$el
        if (typeof value === 'string' && /^\d+$/.test(value)) {
            value = Number(value)
        }
        this.height = value

        if (!el) return Vue.nextTick(() => this.setHeight(value, prop))

        if (typeof value === 'number') {
            el.style[prop] = value + 'px'

            this.updateElsHeight()
        } else if (typeof value === 'string') {
            el.style[prop] = value
            this.updateElsHeight()
        }
    }

    setMaxHeight (value) {
        return this.setHeight(value, 'max-height')
    }

    updateElsHeight () {
        if (this.table.$destroyed) return
        if (!this.table.$ready) return Vue.nextTick(() => this.updateElsHeight())
        const { headerWrapper, appendWrapper, footerWrapper, paginationWrapper } = this.table.$refs
        if (this.table.showPagination && !paginationWrapper) return Vue.nextTick(() => this.updateElsHeight())
        this.appendHeight = appendWrapper ? appendWrapper.offsetHeight : 0
        this.paginationHeight = paginationWrapper ? paginationWrapper.offsetHeight : 0

        if (this.showHeader && !headerWrapper) return
        const headerHeight = (this.headerHeight = !this.showHeader ? 0 : headerWrapper.offsetHeight)
        if (
            this.showHeader
            && headerWrapper.offsetWidth > 0
            && (this.table.columns || []).length > 0
            && headerHeight < 2
        ) {
            return Vue.nextTick(() => this.updateElsHeight())
        }
        const tableHeight = (this.tableHeight = this.table.$el.offsetHeight - this.paginationHeight)
        if (this.height !== null && (!isNaN(this.height) || typeof this.height === 'string')) {
            const footerHeight = (this.footerHeight = footerWrapper ? footerWrapper.offsetHeight : 0)
            this.bodyHeight = tableHeight - headerHeight - footerHeight + (footerWrapper ? 1 : 0)
        }
        this.fixedBodyHeight = this.scrollX ? this.bodyHeight - this.gutterWidth : this.bodyHeight

        const noData = !this.table.data || this.table.data.length === 0
        this.viewportHeight = this.scrollX ? tableHeight - (noData ? 0 : this.gutterWidth) : tableHeight

        this.updateScrollY()
        this.notifyObservers('scrollable')
    }

    getFlattenColumns () {
        const flattenColumns = []
        const columns = this.table.columns
        columns.forEach((column) => {
            if (column.isColumnGroup) {
                flattenColumns.push.apply(flattenColumns, column.columns)
            } else {
                flattenColumns.push(column)
            }
        })

        return flattenColumns
    }

    updateColumnsWidth () {
        if (this.table.$destroyed) return
        const fit = this.fit
        const bodyWidth = this.table.$el.clientWidth
        let bodyMinWidth = 0

        const flattenColumns = this.getFlattenColumns()
        const flexColumns = flattenColumns.filter((column) => typeof column.width !== 'number')

        flattenColumns.forEach((column) => {
            // Clean those columns whose width changed from flex to unflex
            if (typeof column.width === 'number' && column.realWidth) column.realWidth = null
        })

        if (flexColumns.length > 0 && fit) {
            flattenColumns.forEach((column) => {
                bodyMinWidth += column.width || column.minWidth || 80
            })

            const scrollYWidth = this.scrollY ? this.gutterWidth : 0

            if (bodyMinWidth <= bodyWidth - scrollYWidth) {
                // DON'T HAVE SCROLL BAR
                this.scrollX = false

                const totalFlexWidth = bodyWidth - scrollYWidth - bodyMinWidth

                if (flexColumns.length === 1) {
                    flexColumns[0].realWidth = (flexColumns[0].minWidth || 80) + totalFlexWidth
                } else {
                    const allColumnsWidth = flexColumns.reduce((prev, column) => prev + (column.minWidth || 80), 0)
                    const flexWidthPerPixel = totalFlexWidth / allColumnsWidth
                    let noneFirstWidth = 0

                    flexColumns.forEach((column, index) => {
                        if (index === 0) return
                        const flexWidth = Math.floor((column.minWidth || 80) * flexWidthPerPixel)
                        noneFirstWidth += flexWidth
                        column.realWidth = (column.minWidth || 80) + flexWidth
                    })

                    flexColumns[0].realWidth = (flexColumns[0].minWidth || 80) + totalFlexWidth - noneFirstWidth
                }
            } else {
                // HAVE HORIZONTAL SCROLL BAR
                this.scrollX = true
                flexColumns.forEach(function (column) {
                    column.realWidth = column.minWidth
                })
            }

            this.bodyWidth = Math.max(bodyMinWidth, bodyWidth)
            this.table.resizeState.width = this.bodyWidth
        } else {
            flattenColumns.forEach((column) => {
                if (!column.width && !column.minWidth) {
                    column.realWidth = 80
                } else {
                    column.realWidth = column.width || column.minWidth
                }

                bodyMinWidth += column.realWidth
            })
            this.scrollX = bodyMinWidth > bodyWidth
            /**
             * 当所有列均被指定了宽度后，如果列宽总和小于表格宽度，则将宽度差值分配给最右一列
             */
            if (!this.scrollX && flattenColumns.length) {
                const deltaWidth = bodyWidth - bodyMinWidth
                const lastColumn = flattenColumns[flattenColumns.length - 1]
                lastColumn.realWidth = lastColumn.realWidth + deltaWidth
                this.bodyWidth = bodyWidth
            } else {
                this.bodyWidth = bodyMinWidth
            }
        }

        const fixedColumns = this.store.states.fixedColumns

        if (fixedColumns.length > 0) {
            let fixedWidth = 0
            fixedColumns.forEach(function (column) {
                fixedWidth += column.realWidth || column.width
            })

            this.fixedWidth = fixedWidth
        }

        const rightFixedColumns = this.store.states.rightFixedColumns
        if (rightFixedColumns.length > 0) {
            let rightFixedWidth = 0
            rightFixedColumns.forEach(function (column) {
                rightFixedWidth += column.realWidth || column.width
            })

            this.rightFixedWidth = rightFixedWidth
        }

        this.notifyObservers('columns')
    }
    syncRowHeight () {
        if (this.table.$destroyed) return
        if (!this.table.$ready) return Vue.nextTick(this.syncRowHeight)
        const rows = this.table.$refs.tableBody.$refs.row || []
        const rowsHeight = rows.reduce((accumulator, row) => {
            const key = row.getAttribute('data-table-row')
            accumulator[key] = row.offsetHeight
            return accumulator
        }, {})
        if (isShallowEqual(rowsHeight, this.rowsHeight)) return
        this.rowsHeight = rowsHeight
    }

    addObserver (observer) {
        this.observers.push(observer)
    }

    removeObserver (observer) {
        const index = this.observers.indexOf(observer)
        if (index !== -1) {
            this.observers.splice(index, 1)
        }
    }

    notifyObservers (event) {
        const observers = this.observers
        observers.forEach((observer) => {
            switch (event) {
                case 'columns':
                    observer.onColumnsChange(this)
                    break
                case 'scrollable':
                    observer.onScrollableChange(this)
                    break
                default:
                    throw new Error(`Table Layout don't have event ${event}.`)
            }
        })
    }
}

export default TableLayout
