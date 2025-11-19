START TRANSACTION;
CREATE DATABASE wsg_project;
USE wsg_project;
CREATE TABLE test(
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL
);
INSERT INTO test (name)
VALUES
("test1"),
("test2"),
("test3");
COMMIT;