import networkx as nx
from typing import Any
from app.db import catalyst_db as db

class NetworkService:
    @staticmethod
    def get_accused_network(accused_id: int, degrees: int = 2) -> dict:
        """
        Builds a co-accused graph around a given accused_id.
        Traverses shared cases up to the specified degrees of separation.
        """
        # Graph nodes and edges
        nodes = []
        edges = []
        
        visited_accused = set()
        visited_cases = set()
        
        # Simple BFS traversal
        queue = [(accused_id, 0)]  # (accused_id, current_degree)
        visited_accused.add(accused_id)
        
        while queue:
            curr_accused_id, curr_degree = queue.pop(0)
            
            # Fetch the accused details
            accused_row = db.get_row("Accused", curr_accused_id)
            if not accused_row:
                continue
                
            # Add accused node
            accused_node_id = f"accused_{curr_accused_id}"
            nodes.append({
                "id": accused_node_id,
                "label": accused_row["accused_name"],
                "type": "accused",
                "size": 12,
                "color": "#EF4444",
                "metadata": {
                    "age": accused_row.get("age_year"),
                    "gender": accused_row.get("gender"),
                    "person_id": accused_row.get("person_id")
                }
            })
            
            if curr_degree >= degrees:
                continue
                
            # Find all cases this accused is linked to
            all_accused_records = db.get_all_rows("Accused")
            accused_cases = [r["case_master_id"] for r in all_accused_records if r["accused_name"] == accused_row["accused_name"]]
            
            for case_id in accused_cases:
                # Add case node
                case_node_id = f"case_{case_id}"
                if case_id not in visited_cases:
                    visited_cases.add(case_id)
                    case_row = db.get_row("CaseMaster", case_id)
                    if case_row:
                        nodes.append({
                            "id": case_node_id,
                            "label": case_row["crime_no"],
                            "type": "case",
                            "size": 10,
                            "color": "#F59E0B",
                            "metadata": {
                                "date": case_row.get("crime_registered_date"),
                                "brief": case_row.get("brief_facts")
                            }
                        })
                
                # Link accused to case
                edges.append({
                    "source": accused_node_id,
                    "target": case_node_id,
                    "relationship": "accused_in",
                    "weight": 1.0
                })
                
                # Find all co-accused in this case
                co_accused_records = [r for r in all_accused_records if r["case_master_id"] == case_id]
                for co_rec in co_accused_records:
                    co_name = co_rec["accused_name"]
                    # Find master ID of co-accused (first record with this name)
                    co_master_row = next((r for r in all_accused_records if r["accused_name"] == co_name), None)
                    if not co_master_row:
                        continue
                    co_id = co_master_row["ROWID"]
                    
                    if co_id not in visited_accused:
                        visited_accused.add(co_id)
                        queue.append((co_id, curr_degree + 1))
                        
                    co_node_id = f"accused_{co_id}"
                    if curr_accused_id != co_id:
                        # Link co-accused to case
                        edges.append({
                            "source": co_node_id,
                            "target": case_node_id,
                            "relationship": "accused_in",
                            "weight": 1.0
                        })

        # Find communities/clusters using NetworkX
        g = nx.Graph()
        for node in nodes:
            g.add_node(node["id"])
        for edge in edges:
            g.add_edge(edge["source"], edge["target"])
            
        clusters = []
        try:
            # Find connected components as clusters
            components = list(nx.connected_components(g))
            for idx, comp in enumerate(components):
                accused_members = [node_id.split("_")[1] for node_id in comp if node_id.startswith("accused_")]
                # Find associated cases
                cases_linked = [int(node_id.split("_")[1]) for node_id in comp if node_id.startswith("case_")]
                if len(accused_members) >= 2:
                    clusters.append({
                        "cluster_id": idx + 1,
                        "members": [db.get_row("Accused", int(mid))["accused_name"] for mid in accused_members if db.get_row("Accused", int(mid))],
                        "size": len(accused_members),
                        "case_count": len(cases_linked)
                    })
        except Exception:
            pass

        return {
            "nodes": nodes,
            "edges": edges,
            "clusters": sorted(clusters, key=lambda x: x["size"], reverse=True)
        }

    @staticmethod
    def get_clusters(min_cluster_size: int = 3) -> dict:
        """Finds all large co-accused clusters in the database."""
        g = nx.Graph()
        
        all_accused = db.get_all_rows("Accused")
        # Build co-accused relationships (accused names sharing case_master_id)
        case_to_accused = {}
        for r in all_accused:
            case_id = r["case_master_id"]
            name = r["accused_name"]
            if case_id not in case_to_accused:
                case_to_accused[case_id] = []
            case_to_accused[case_id].append(name)
            g.add_node(name)
            
        for case_id, names in case_to_accused.items():
            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    g.add_edge(names[i], names[j])
                    
        clusters = []
        components = list(nx.connected_components(g))
        for idx, comp in enumerate(components):
            if len(comp) >= min_cluster_size:
                # Find cases linked to this component
                linked_cases = set()
                for name in comp:
                    for r in all_accused:
                        if r["accused_name"] == name:
                            linked_cases.add(r["case_master_id"])
                            
                clusters.append({
                    "cluster_id": idx + 1,
                    "members": list(comp),
                    "size": len(comp),
                    "case_count": len(linked_cases)
                })
                
        return {"clusters": sorted(clusters, key=lambda x: x["size"], reverse=True)}