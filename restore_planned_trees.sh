sed -i '2427,2434d' src/views/Orchard.tsx
cat << 'INNER_EOF' > /tmp/planned_trees_full.tsx
              </div>
            )}
          </div>
        </div>

        {/* Planned Trees (Wishlist) */}
        {plannedTrees.length > 0 && (
          <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200/60 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-medium text-amber-900 flex items-center gap-2">
                <List className="w-5 h-5 text-amber-600" />
                Projets de plantation
              </h3>
              <div className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">En attente</div>
            </div>
            <p className="text-sm text-amber-700/80 mb-4">Ces arbres ont été planifiés depuis le calendrier des récoltes. Cliquez sur "Placer" pour les ajouter au verger.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plannedTrees.map(tree => {
                const encEntry = encyclopedia?.find(e => e.name === tree.species);
                const color = encEntry?.color || '#f59e0b';
                const Icon = ICON_MAP[encEntry?.icon || ''] || Trees;
                
                return (
                  <div key={tree.id} className="flex flex-col bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
                          {isEmoji(encEntry?.icon || '') ? <span className="text-xl">{encEntry?.icon}</span> : <Icon className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-stone-900 leading-tight">{tree.species}</h4>
                          {tree.variety && <p className="text-xs text-stone-500 mt-0.5">{tree.variety}</p>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlacePlannedTree(tree)}
                      className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium rounded-xl transition"
                    >
                      Placer sur le plan
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
INNER_EOF
sed -i '2426r /tmp/planned_trees_full.tsx' src/views/Orchard.tsx
