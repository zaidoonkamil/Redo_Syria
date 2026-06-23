const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RechargeCode = sequelize.define(
  "RechargeCode",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "redeemed", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
    createdByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    redeemedByDriverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    redeemedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "recharge_codes",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["code"] },
      { fields: ["status"] },
      { fields: ["redeemedByDriverId"] },
      { fields: ["createdAt"] },
    ],
  }
);

module.exports = RechargeCode;
