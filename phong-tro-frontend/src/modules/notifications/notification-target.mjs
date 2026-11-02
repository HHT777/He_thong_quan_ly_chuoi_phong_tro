export function ownerIncidentTarget(row) {
  const target = row?.target;
  return target?.verified === true && target.resourceType === "incident"
    && /^\/operations\/incidents\?incidentId=[0-9a-f-]{36}$/i.test(target.route || "") ? target.route : null;
}
