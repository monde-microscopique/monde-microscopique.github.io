#!/usr/bin/env python3
"""Calcule hors ligne les coordonnées des molécules du site (fiche F-A, règle 4 du protocole).

Entrée : molecules/sources.json (nom, notation SMILES, formule et masse molaire attendues).
Sortie : molecules/<id>.json, avec, pour chaque atome, l'élément, les coordonnées 3D (pm) et la
position dans la formule plane (pm) ; les liaisons et leur ordre (1, 2, 3, cycles aromatiques écrits
avec trois liaisons doubles alternées) ; la formule brute et la masse molaire (masses du polycopié).

Usage : python3 outils/molecules.py   (RDKit requis : pip install rdkit)
Le résultat est enregistré dans le dépôt : la publication n'a pas besoin de Python.
"""
import json, sys
from pathlib import Path
from rdkit import Chem
from rdkit.Chem import AllChem, rdDepictor, rdMolDescriptors

RACINE = Path(__file__).resolve().parent.parent
# Masses atomiques du polycopié (chapitre 4).
MASSES = {'H': 1.008, 'C': 12.01, 'N': 14.01, 'O': 16.00, 'Na': 22.99, 'Mg': 24.31, 'P': 30.97, 'S': 32.06, 'Cl': 35.45, 'Ca': 40.08, 'Cu': 63.55}
ORDRE_HILL = lambda el: (0 if el == 'C' else 1 if el == 'H' else 2, el)

def calculer(cle, src):
    mol = Chem.MolFromSmiles(src['smiles'])
    if mol is None:
        raise SystemExit(f'{cle} : notation SMILES illisible')
    Chem.Kekulize(mol, clearAromaticFlags=True)  # cycles aromatiques : liaisons doubles alternées, jamais de cercle
    molH = Chem.AddHs(mol)
    if AllChem.EmbedMolecule(molH, randomSeed=20261118) != 0:
        raise SystemExit(f'{cle} : géométrie 3D impossible')
    AllChem.MMFFOptimizeMolecule(molH, maxIters=2000)
    conf = molH.GetConformer()
    plan = Chem.Mol(molH)
    rdDepictor.SetPreferCoordGen(True)
    rdDepictor.Compute2DCoords(plan)
    conf2 = plan.GetConformer()
    atomes = []
    n = molH.GetNumAtoms()
    centre = [sum(conf.GetAtomPosition(i)[k] for i in range(n)) / n for k in range(3)]
    centre2 = [sum(conf2.GetAtomPosition(i)[k] for i in range(n)) / n for k in range(2)]
    for a in molH.GetAtoms():
        i = a.GetIdx()
        p = conf.GetAtomPosition(i)
        q = conf2.GetAtomPosition(i)
        atomes.append({
            'el': a.GetSymbol(),
            'charge': a.GetFormalCharge(),
            'pos': [round((p[k] - centre[k]) * 100, 1) for k in range(3)],          # Å → pm
            'plan': [round((q[k] - centre2[k]) * 100, 1) for k in range(2)],        # unités RDKit ≈ 1,5 par liaison → ×100
        })
    liaisons = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(round(b.GetBondTypeAsDouble()))] for b in molH.GetBonds()]
    compte = {}
    for a in atomes:
        compte[a['el']] = compte.get(a['el'], 0) + 1
    formule = ''.join(f'{el}{compte[el] if compte[el] > 1 else ""}' for el in sorted(compte, key=ORDRE_HILL))
    M = sum(MASSES[el] * k for el, k in compte.items())
    if formule != src['formule_attendue']:
        raise SystemExit(f"{cle} : formule {formule}, attendue {src['formule_attendue']}")
    if abs(M - src['M_attendue']) > 0.06:
        raise SystemExit(f"{cle} : M = {M:.2f} g/mol, attendue {src['M_attendue']}")
    cip = {a.GetIdx(): a.GetProp('_CIPCode') for a in mol.GetAtoms() if a.HasProp('_CIPCode')}
    Chem.AssignStereochemistry(mol, cleanIt=True, force=True)
    cip = {a.GetIdx(): a.GetProp('_CIPCode') for a in mol.GetAtoms() if a.HasProp('_CIPCode')}
    return {
        'id': cle, 'nom': src['nom'], 'smiles': src['smiles'], 'remarque': src.get('remarque', ''),
        'formule': formule, 'compte': compte, 'M': round(M, 2),
        'stereo': cip,
        'atomes': atomes, 'liaisons': liaisons,
        'source': "coordonnées calculées par RDKit (ETKDG puis champ de force MMFF94, graine fixe) à partir de la notation SMILES ; formule plane : RDKit (CoordGen)",
    }

def main():
    sources = json.loads((RACINE / 'molecules' / 'sources.json').read_text(encoding='utf-8'))
    for cle, src in sources.items():
        if cle.startswith('_'):
            continue
        res = calculer(cle, src)
        (RACINE / 'molecules' / f'{cle}.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f"{cle:16s} {res['formule']:10s} M = {res['M']:.2f} g/mol  {len(res['atomes'])} atomes  stéréo {res['stereo']}")

if __name__ == '__main__':
    main()
