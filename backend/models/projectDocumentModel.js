const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./projectModel");

const ProjectDocument = sequelize.define(
  "ProjectDocument",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Project,
        key: "id",
      },
      // Note: Relationships will be defined in models/index.js
    },
    documentUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Document URL is required",
        },
      },
    },
  },
  {
    tableName: "project_documents",
    timestamps: true,
    indexes: [
      {
        fields: ["projectId"],
      },
    ],
  }
);

module.exports = ProjectDocument;

