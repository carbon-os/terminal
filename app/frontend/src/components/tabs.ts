import Draggabilly from 'draggabilly'

const TAB_CONTENT_MARGIN = 9
const TAB_CONTENT_OVERLAP_DISTANCE = 1
const TAB_CONTENT_MIN_WIDTH = 24
const TAB_CONTENT_MAX_WIDTH = 240
const TAB_SIZE_SMALL = 84
const TAB_SIZE_SMALLER = 60
const TAB_SIZE_MINI = 48

const noop = () => {}

function closest(value: number, array: number[]): number {
  let closestDist = Infinity
  let closestIndex = -1
  array.forEach((v, i) => {
    if (Math.abs(value - v) < closestDist) {
      closestDist = Math.abs(value - v)
      closestIndex = i
    }
  })
  return closestIndex
}

const tabTemplate = `
  <div class="browser-tab">
    <div class="browser-tab-dividers"></div>
    <div class="browser-tab-background">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <symbol id="browser-tab-geometry-left" viewBox="0 0 214 36">
            <path d="M17 0h197v36H0v-2c4.5 0 9-3.5 9-8V8c0-4.5 3.5-8 8-8z"/>
          </symbol>
          <symbol id="browser-tab-geometry-right" viewBox="0 0 214 36">
            <use xlink:href="#browser-tab-geometry-left"/>
          </symbol>
          <clipPath id="crop">
            <rect class="mask" width="100%" height="100%" x="0"/>
          </clipPath>
        </defs>
        <svg width="52%" height="100%">
          <use xlink:href="#browser-tab-geometry-left" width="214" height="36" class="browser-tab-geometry"/>
        </svg>
        <g transform="scale(-1, 1)">
          <svg width="52%" height="100%" x="-100%" y="0">
            <use xlink:href="#browser-tab-geometry-right" width="214" height="36" class="browser-tab-geometry"/>
          </svg>
        </g>
      </svg>
    </div>
    <div class="browser-tab-content">
      <div class="browser-tab-favicon"></div>
      <div class="browser-tab-title"></div>
      <div class="browser-tab-drag-handle"></div>
      <div class="browser-tab-close"></div>
    </div>
  </div>
`

export interface TabProperties {
  title?: string
  favicon?: string | false
  id?: string
}

export interface AddTabOptions {
  animate?: boolean
  background?: boolean
}

const defaultTabProperties: Required<TabProperties> = {
  title: 'New tab',
  favicon: false,
  id: '',
}

let instanceId = 0

export class BrowserTabsCore {
  el!: HTMLElement
  instanceId!: number
  styleEl!: HTMLStyleElement
  draggabillies: InstanceType<typeof Draggabilly>[] = []
  isDragging = false
  draggabillyDragging: any = null

  init(el: HTMLElement) {
    this.el = el
    this.instanceId = instanceId
    this.el.setAttribute('data-browser-tabs-instance-id', String(this.instanceId))
    instanceId += 1

    this.setupCustomProperties()
    this.setupStyleEl()
    this.setupEvents()
    this.layoutTabs()
    this.setupDraggabilly()
  }

  emit(eventName: string, data: object) {
    this.el.dispatchEvent(new CustomEvent(eventName, { detail: data }))
  }

  setupCustomProperties() {
    this.el.style.setProperty('--tab-content-margin', `${TAB_CONTENT_MARGIN}px`)
  }

  setupStyleEl() {
    this.styleEl = document.createElement('style')
    this.el.appendChild(this.styleEl)
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      this.cleanUpPreviouslyDraggedTabs()
      this.layoutTabs()
    })

    this.el.addEventListener('dblclick', (event) => {
      if ([this.el, this.tabContentEl].includes(event.target as HTMLElement)) {
        this.addTab()
      }
    })

    this.tabEls.forEach((tabEl) => this.setTabCloseEventListener(tabEl))
  }

  get tabEls(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>('.browser-tab'))
  }

  get tabContentEl(): HTMLElement {
    return this.el.querySelector<HTMLElement>('.browser-tabs-content')!
  }

  get tabContentWidths(): number[] {
    const numberOfTabs = this.tabEls.length
    const tabsContentWidth = this.tabContentEl.clientWidth
    const tabsCumulativeOverlappedWidth = (numberOfTabs - 1) * TAB_CONTENT_OVERLAP_DISTANCE
    const targetWidth =
      (tabsContentWidth - 2 * TAB_CONTENT_MARGIN + tabsCumulativeOverlappedWidth) / numberOfTabs
    const clampedTargetWidth = Math.max(TAB_CONTENT_MIN_WIDTH, Math.min(TAB_CONTENT_MAX_WIDTH, targetWidth))
    const flooredClampedTargetWidth = Math.floor(clampedTargetWidth)
    const totalTabsWidthUsingTarget =
      flooredClampedTargetWidth * numberOfTabs + 2 * TAB_CONTENT_MARGIN - tabsCumulativeOverlappedWidth
    const totalExtraWidthDueToFlooring = tabsContentWidth - totalTabsWidthUsingTarget

    const widths: number[] = []
    let extraWidthRemaining = totalExtraWidthDueToFlooring
    for (let i = 0; i < numberOfTabs; i++) {
      const extraWidth =
        flooredClampedTargetWidth < TAB_CONTENT_MAX_WIDTH && extraWidthRemaining > 0 ? 1 : 0
      widths.push(flooredClampedTargetWidth + extraWidth)
      if (extraWidthRemaining > 0) extraWidthRemaining -= 1
    }

    return widths
  }

  get tabContentPositions(): number[] {
    const positions: number[] = []
    const tabContentWidths = this.tabContentWidths

    let position = TAB_CONTENT_MARGIN
    tabContentWidths.forEach((width, i) => {
      const offset = i * TAB_CONTENT_OVERLAP_DISTANCE
      positions.push(position - offset)
      position += width
    })

    return positions
  }

  get tabPositions(): number[] {
    return this.tabContentPositions.map((p) => p - TAB_CONTENT_MARGIN)
  }

  layoutTabs() {
    const tabContentWidths = this.tabContentWidths

    this.tabEls.forEach((tabEl, i) => {
      const contentWidth = tabContentWidths[i]
      const width = contentWidth + 2 * TAB_CONTENT_MARGIN

      tabEl.style.width = `${width}px`
      tabEl.removeAttribute('is-small')
      tabEl.removeAttribute('is-smaller')
      tabEl.removeAttribute('is-mini')

      if (contentWidth < TAB_SIZE_SMALL)   tabEl.setAttribute('is-small',   '')
      if (contentWidth < TAB_SIZE_SMALLER) tabEl.setAttribute('is-smaller', '')
      if (contentWidth < TAB_SIZE_MINI)    tabEl.setAttribute('is-mini',    '')
    })

    let styleHTML = ''
    this.tabPositions.forEach((position, i) => {
      styleHTML += `
        .browser-tabs[data-browser-tabs-instance-id="${this.instanceId}"] .browser-tab:nth-child(${i + 1}) {
          transform: translate3d(${position}px, 0, 0)
        }
      `
    })
    this.styleEl.innerHTML = styleHTML
  }

  createNewTabEl(): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = tabTemplate
    return div.firstElementChild as HTMLElement
  }

  addTab(tabProperties: TabProperties = {}, { animate = true, background = false }: AddTabOptions = {}) {
    const tabEl = this.createNewTabEl()

    if (animate) {
      tabEl.classList.add('browser-tab-was-just-added')
      setTimeout(() => tabEl.classList.remove('browser-tab-was-just-added'), 500)
    }

    const mergedProperties = { ...defaultTabProperties, ...tabProperties }
    this.tabContentEl.appendChild(tabEl)
    this.setTabCloseEventListener(tabEl)
    this.updateTab(tabEl, mergedProperties)
    this.emit('tabAdd', { tabEl })
    if (!background) this.setCurrentTab(tabEl)
    this.cleanUpPreviouslyDraggedTabs()
    this.layoutTabs()
    this.setupDraggabilly()
  }

  setTabCloseEventListener(tabEl: HTMLElement) {
    tabEl.querySelector('.browser-tab-close')!.addEventListener('click', () => this.removeTab(tabEl))
  }

  get activeTabEl(): HTMLElement | null {
    return this.el.querySelector<HTMLElement>('.browser-tab[active]')
  }

  setCurrentTab(tabEl: HTMLElement) {
    const activeTabEl = this.activeTabEl
    if (activeTabEl === tabEl) return
    if (activeTabEl) activeTabEl.removeAttribute('active')
    tabEl.setAttribute('active', '')
    this.emit('activeTabChange', { tabEl })
  }

  removeTab(tabEl: HTMLElement) {
    if (tabEl === this.activeTabEl) {
      if (tabEl.nextElementSibling) {
        this.setCurrentTab(tabEl.nextElementSibling as HTMLElement)
      } else if (tabEl.previousElementSibling) {
        this.setCurrentTab(tabEl.previousElementSibling as HTMLElement)
      }
    }
    tabEl.parentNode!.removeChild(tabEl)
    this.emit('tabRemove', { tabEl })
    this.cleanUpPreviouslyDraggedTabs()
    this.layoutTabs()
    this.setupDraggabilly()
  }

  updateTab(tabEl: HTMLElement, tabProperties: Required<TabProperties>) {
    tabEl.querySelector<HTMLElement>('.browser-tab-title')!.textContent = tabProperties.title

    const faviconEl = tabEl.querySelector<HTMLElement>('.browser-tab-favicon')!
    if (tabProperties.favicon) {
      faviconEl.style.backgroundImage = `url('${tabProperties.favicon}')`
      faviconEl.removeAttribute('hidden')
    } else {
      faviconEl.setAttribute('hidden', '')
      faviconEl.removeAttribute('style')
    }

    if (tabProperties.id) {
      tabEl.setAttribute('data-tab-id', tabProperties.id)
    }
  }

  cleanUpPreviouslyDraggedTabs() {
    this.tabEls.forEach((tabEl) => tabEl.classList.remove('browser-tab-was-just-dragged'))
  }

  setupDraggabilly() {
    const tabEls = this.tabEls
    const tabPositions = this.tabPositions

    if (this.isDragging) {
      this.isDragging = false
      this.el.classList.remove('browser-tabs-is-sorting')
      this.draggabillyDragging.element.classList.remove('browser-tab-is-dragging')
      this.draggabillyDragging.element.style.transform = ''
      this.draggabillyDragging.dragEnd()
      this.draggabillyDragging.isDragging = false
      this.draggabillyDragging.positionDrag = noop
      this.draggabillyDragging.destroy()
      this.draggabillyDragging = null
    }

    this.draggabillies.forEach((d) => d.destroy())
    this.draggabillies = []

    tabEls.forEach((tabEl, originalIndex) => {
      const originalTabPositionX = tabPositions[originalIndex]
      const draggabilly = new Draggabilly(tabEl, {
        axis: 'x',
        handle: '.browser-tab-drag-handle',
        containment: this.tabContentEl,
      })

      this.draggabillies.push(draggabilly)

      draggabilly.on('pointerDown', () => this.setCurrentTab(tabEl))

      draggabilly.on('dragStart', () => {
        this.isDragging = true
        this.draggabillyDragging = draggabilly
        tabEl.classList.add('browser-tab-is-dragging')
        this.el.classList.add('browser-tabs-is-sorting')
      })

      draggabilly.on('dragEnd', () => {
        this.isDragging = false
        const finalTranslateX = parseFloat(tabEl.style.left)
        tabEl.style.transform = 'translate3d(0, 0, 0)'

        requestAnimationFrame(() => {
          tabEl.style.left = '0'
          tabEl.style.transform = `translate3d(${finalTranslateX}px, 0, 0)`

          requestAnimationFrame(() => {
            tabEl.classList.remove('browser-tab-is-dragging')
            this.el.classList.remove('browser-tabs-is-sorting')
            tabEl.classList.add('browser-tab-was-just-dragged')

            requestAnimationFrame(() => {
              tabEl.style.transform = ''
              this.layoutTabs()
              this.setupDraggabilly()
            })
          })
        })
      })

      draggabilly.on('dragMove', (_event: Event, _pointer: object, moveVector: { x: number }) => {
        const currentTabEls = this.tabEls
        const currentIndex = currentTabEls.indexOf(tabEl)
        const currentTabPositionX = originalTabPositionX + moveVector.x
        const destinationIndexTarget = closest(currentTabPositionX, tabPositions)
        const destinationIndex = Math.max(0, Math.min(currentTabEls.length, destinationIndexTarget))

        if (currentIndex !== destinationIndex) {
          this.animateTabMove(tabEl, currentIndex, destinationIndex)
        }
      })
    })
  }

  animateTabMove(tabEl: HTMLElement, originIndex: number, destinationIndex: number) {
    if (destinationIndex < originIndex) {
      tabEl.parentNode!.insertBefore(tabEl, this.tabEls[destinationIndex])
    } else {
      tabEl.parentNode!.insertBefore(tabEl, this.tabEls[destinationIndex + 1])
    }
    this.emit('tabReorder', { tabEl, originIndex, destinationIndex })
    this.layoutTabs()
  }

  // ── ID-based helpers (for React state bridge) ─────────────────────────────

  getTabById(id: string): HTMLElement | undefined {
    return this.tabEls.find(el => el.getAttribute('data-tab-id') === id)
  }

  setCurrentTabById(id: string) {
    const el = this.getTabById(id)
    if (el) this.setCurrentTab(el)
  }

  removeTabById(id: string) {
    const el = this.getTabById(id)
    if (el) this.removeTab(el)
  }

  destroy() {
    this.draggabillies.forEach((d) => d.destroy())
  }
}