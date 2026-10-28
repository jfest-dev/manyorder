package com.manyorder.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ManyorderApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(ManyorderApiApplication.class, args);
	}

}
