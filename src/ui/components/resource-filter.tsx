import { RESOURCES, ResourceCategory, type ResourceId } from '../../domain';
import { Button } from './ui/button';
export function ResourceFilter({
  selected,
  onChange,
}: {
  selected: ResourceId[];
  onChange: (ids: ResourceId[]) => void;
}) {
  return (
    <div className="resource-filter">
      <div className="filter-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(RESOURCES.map((resource) => resource.id))}
        >
          Select all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
      {[ResourceCategory.Room, ResourceCategory.Equipment].map((category) => (
        <fieldset key={category}>
          <legend>
            {category === ResourceCategory.Room ? 'Rooms' : 'Equipment'}
          </legend>
          {RESOURCES.filter((resource) => resource.category === category).map(
            (resource) => (
              <label key={resource.id} className="filter-check">
                <input
                  type="checkbox"
                  checked={selected.includes(resource.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, resource.id]
                        : selected.filter((id) => id !== resource.id),
                    )
                  }
                />
                <span
                  className="resource-dot"
                  style={{ background: `var(--${resource.colorToken})` }}
                />
                {resource.name}
              </label>
            ),
          )}
        </fieldset>
      ))}
    </div>
  );
}
