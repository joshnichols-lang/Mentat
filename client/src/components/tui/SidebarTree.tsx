import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface TreeNode {
  label: string;
  path?: string;
  icon?: string;
  children?: TreeNode[];
}

interface SidebarTreeProps {
  nodes: TreeNode[];
  level?: number;
}

function TreeItem({ node, level = 0, isLast = false }: { node: TreeNode; level?: number; isLast?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  const [location] = useLocation();
  const hasChildren = node.children && node.children.length > 0;
  const isActive = node.path === location;
  
  const prefix = level === 0 ? "" : isLast ? "└─ " : "├─ ";
  
  return (
    <div>
      <div 
        className={`flex items-center gap-1 py-0.5 px-2 cursor-pointer hover:bg-primary/20 ${
          isActive ? "bg-primary/30 text-primary" : "text-foreground"
        }`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        data-testid={`tree-item-${node.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="text-xs opacity-50">{prefix}</span>
        {hasChildren && (
          <span className="text-[10px]">
            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        )}
        {node.icon && <span className="text-xs">{node.icon}</span>}
        {node.path ? (
          <Link href={node.path} className="text-xs flex-1">
            {node.label}
          </Link>
        ) : (
          <span className="text-xs flex-1">{node.label}</span>
        )}
      </div>
      
      {hasChildren && isOpen && (
        <div className="ml-3">
          {node.children!.map((child, idx) => (
            <TreeItem 
              key={idx} 
              node={child} 
              level={level + 1}
              isLast={idx === node.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarTree({ nodes, level = 0 }: SidebarTreeProps) {
  return (
    <div className="font-mono text-xs">
      {nodes.map((node, idx) => (
        <TreeItem 
          key={idx} 
          node={node} 
          level={level}
          isLast={idx === nodes.length - 1}
        />
      ))}
    </div>
  );
}

export type { TreeNode };
