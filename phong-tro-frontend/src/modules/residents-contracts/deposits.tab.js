// Keep old bookmarks working after moving deposits into contract details.
export default {
  id: "deposits",
  route: "/residents-contracts/deposits",
  title: "Tiền cọc",
  group: "residents-contracts",
  hiddenFromNav: true,
  roles: ["CHU_TRO"],
  render: (context) => context.go("/residents-contracts/contracts"),
};
