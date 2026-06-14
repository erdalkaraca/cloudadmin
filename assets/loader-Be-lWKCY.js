import{B as e,D as t,E as n,F as r,H as i,L as a,N as o,O as s,S as c,l,o as u,ot as d,st as f,z as p}from"./dist-DFIIeeW2.js";import{d as m,f as h}from"./fs-access-D-fDaJ8V-D4qvKoNj.js";import"./lit-Kr-z_jtQ.js";var g,_=`catalog.root`,v=`No catalog entries yet. Install or enable extensions that contribute catalog items.`,y=class extends u{static{g=this}constructor(...e){super(...e),this.treeRef=n()}doBeforeUI(){this.rebuildTree(),this.contributionsSubscriptionToken=m(a,e=>{(e.target===`catalog.root`||e.target?.startsWith(`catalog.`))&&this.rebuildTree()})}doClose(){this.contributionsSubscriptionToken&&=(h(this.contributionsSubscriptionToken),void 0),super.doClose()}rebuildTree(){let e=i.getContributions(_);this.rootNodes=this.toTreeNodes(e),this.requestUpdate()}renderToolbar(){return d`
            <docks-command
                icon="file-arrow-down"
                title="Checkout"
                ?disabled=${!(p.get()instanceof g&&e.get()!==void 0)}
                .action=${()=>this.runWgetForSelection()}
            ></docks-command>
            <docks-command icon="arrows-rotate" title="Refresh Catalog" .action=${()=>this.refresh()}></docks-command>
            <docks-command icon="angles-down" slot="end" title="Expand All" .action=${()=>this.setAllExpanded(!0)}></docks-command>
            <docks-command icon="angles-up" slot="end" title="Collapse All" .action=${()=>this.setAllExpanded(!1)}></docks-command>
        `}toTreeNodes(e){return e.map(e=>{let t={data:e.state,icon:e.icon,label:e.label,leaf:!1};if(e.contributionId){let n=i.getContributions(e.contributionId);t.leaf=n.length===0,t.children=this.toTreeNodes(n)}return t})}wgetParamsFromCatalogData(e){if(!e?.url)return null;let t={url:e.url};return typeof e.filename==`string`&&e.filename.trim()&&(t.filename=e.filename.trim()),t}onItemDblClicked(e){let t=e.currentTarget,n=t?.model;if(!n)return;let r=this.wgetParamsFromCatalogData(n.data);if(r){this.executeCommand(`wget`,r);return}!n.leaf&&`expanded`in t&&(t.expanded=!t.expanded)}runWgetForSelection(){let t=e.get(),n=t&&this.wgetParamsFromCatalogData(t);n&&this.executeCommand(`wget`,n)}onSelectionChanged(t){let n=t.detail.selection[0].model;e.set(n.data)}renderContextMenu(){let t=p.get()instanceof g?e.get():void 0;return d`
            <docks-command
                icon="file-arrow-down"
                title="Checkout"
                ?disabled=${!(t&&`url`in t&&t.url)}
                .action=${()=>this.runWgetForSelection()}
            >Checkout</docks-command>
        `}setAllExpanded(e){let t=this.treeRef.value;t&&t.querySelectorAll(`wa-tree-item`).forEach(t=>{t.expanded=e})}refresh(){this.rebuildTree()}createTreeItems(e,t=!1){return e?d`
            <wa-tree-item
                @dblclick=${this.nobubble(this.onItemDblClicked)}
                .model=${e}
                ?expanded=${t}
            >
                <span>${c(e.icon)} ${e.label}</span>
                ${e.children?.map(e=>this.createTreeItems(e))}
            </wa-tree-item>
        `:d``}renderContent(){return d`
            <div class="catalog-root">
                ${(this.rootNodes?.length??0)>0?d`
                          <wa-tree
                              ${t(this.treeRef)}
                              @wa-selection-change=${this.nobubble(this.onSelectionChanged)}
                              style="--indent-guide-width: 1px;"
                          >
                              ${this.rootNodes.map(e=>this.createTreeItems(e,!0))}
                          </wa-tree>
                      `:d`
                          <docks-no-content
                              message=${v}
                              icon="book"
                          ></docks-no-content>
                      `}
            </div>
        `}static{this.styles=f`
        :host {
            display: flex;
            flex-direction: column;
        }

        .catalog-root {
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .catalog-root wa-tree {
            flex: 1;
            min-height: 0;
        }
    `}};s([o()],y.prototype,`rootNodes`,void 0),y=g=s([r(`docks-catalog`)],y),i.registerContribution(l,{name:`catalog`,label:`Catalog`,icon:`book`,component:e=>d`<docks-catalog id="${e}"></docks-catalog>`});